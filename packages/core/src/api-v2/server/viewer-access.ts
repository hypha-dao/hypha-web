import 'server-only';

import { spaces as spacesTable } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../server';
import { ChainFactsCache } from '../chain-cache';
import {
  NO_RELATION,
  isLevelSatisfied,
  type SpaceRelation,
} from '../visibility-rule';
import {
  readDelegateSpaceIds,
  readDelegatorsBatch,
  readMemberSpaceIds,
  readSpaceMembersBatch,
  readSpaceVisibilityBatch,
  type SpaceMembersAndExecutor,
  type SpaceVisibility,
} from './chain-reads';
import type { V2Caller } from './access';

/**
 * Bulk, cached resolution of "how is this viewer related to these spaces".
 * Shared by the access gate (one space) and the viewer-aware list (many), so
 * the rule is evaluated in one place. Cost model (see the registry):
 *   levels          1 multicall for all uncached spaces
 *   viewer facts    getMemberSpaces + getSpacesForDelegate (2 reads), 1 multicall
 *                   for the member spaces' executors, 2 multicalls for the
 *                   listed-delegate spaces (members + delegators)
 *   candidates      1 multicall for the members of level-2 spaces that need it
 *   organisations   1 DB read of (id, parent, web3 id) for all spaces
 * Chain facts are cached briefly (chain-cache.ts); nothing per viewer is
 * cached as a response.
 */

const levelsCache = new ChainFactsCache<SpaceVisibility>();
const membersCache = new ChainFactsCache<SpaceMembersAndExecutor>();
const factsCache = new ChainFactsCache<ViewerFacts>();

/** Test hook. */
export function clearChainFactsCaches() {
  levelsCache.clear();
  membersCache.clear();
  factsCache.clear();
}

/** `discoverability` and `access` per space; unreadable spaces are ABSENT (fail closed). */
export async function getSpaceLevels(
  web3SpaceIds: number[],
): Promise<Map<number, SpaceVisibility>> {
  const keys = [...new Set(web3SpaceIds)].map(String);
  const got = await levelsCache.getMany(keys, async (missing) => {
    const read = await readSpaceVisibilityBatch(missing.map(Number));
    return new Map([...read].map(([id, v]) => [String(id), v]));
  });
  return new Map([...got].map(([id, v]) => [Number(id), v]));
}

async function getSpaceMembers(
  web3SpaceIds: number[],
): Promise<Map<number, SpaceMembersAndExecutor>> {
  const keys = [...new Set(web3SpaceIds)].map(String);
  const got = await membersCache.getMany(keys, async (missing) => {
    const read = await readSpaceMembersBatch(missing.map(Number));
    return new Map([...read].map(([id, v]) => [String(id), v]));
  });
  return new Map([...got].map(([id, v]) => [Number(id), v]));
}

type ViewerFacts = {
  /** Spaces the viewer is a member of, or a delegate with a member delegator. */
  directSpaceIds: Set<number>;
  /** Lowercase executor addresses of the spaces the viewer is a member of. */
  memberSpaceExecutors: Set<string>;
};

async function getViewerFacts(
  address: `0x${string}`,
): Promise<ViewerFacts | null> {
  const key = address.toLowerCase();
  const got = await factsCache.getMany([key], async () => {
    const [memberIds, listedDelegateIds] = await Promise.all([
      readMemberSpaceIds(address),
      readDelegateSpaceIds(address),
    ]);
    const memberSet = new Set(memberIds);
    const delegateIds = listedDelegateIds.filter((id) => !memberSet.has(id));

    const [memberDetails, delegateDetails, delegators] = await Promise.all([
      readSpaceMembersBatch(memberIds),
      readSpaceMembersBatch(delegateIds),
      readDelegatorsBatch(address, delegateIds),
    ]);

    const direct = new Set(memberIds);
    for (const id of delegateIds) {
      const members = new Set(delegateDetails.get(id)?.members ?? []);
      if ((delegators.get(id) ?? []).some((d) => members.has(d))) {
        direct.add(id);
      }
    }
    const executors = new Set<string>();
    for (const id of memberIds) {
      const executor = memberDetails.get(id)?.executor;
      if (executor) executors.add(executor);
    }
    return new Map([
      [key, { directSpaceIds: direct, memberSpaceExecutors: executors }],
    ]);
  });
  return got.get(key) ?? null;
}

/**
 * DB organisation grouping, read once: an organisation is the whole tree of
 * the node (same definition as `findAllOrganizationSpacesForNodeById`: climb to
 * the root, take every descendant). Returns web3 space id -> organisation root.
 */
async function loadOrganisationRoots(
  db: DbConfig['db'],
): Promise<Map<number, number>> {
  const rows = await db
    .select({
      id: spacesTable.id,
      parentId: spacesTable.parentId,
      web3SpaceId: spacesTable.web3SpaceId,
    })
    .from(spacesTable);

  const parentOf = new Map<number, number | null>(
    rows.map((r) => [r.id, r.parentId ?? null]),
  );
  const rootOf = (id: number): number => {
    let current = id;
    const seen = new Set<number>();
    while (true) {
      const parent = parentOf.get(current);
      if (parent == null || seen.has(parent)) return current;
      seen.add(current);
      current = parent;
    }
  };
  const result = new Map<number, number>();
  for (const r of rows) {
    if (typeof r.web3SpaceId === 'number')
      result.set(r.web3SpaceId, rootOf(r.id));
  }
  return result;
}

/**
 * Relation of the caller to each target space. `levelOf` lets the function
 * skip work: organisation and member-space checks only run for level-2
 * targets the viewer is not already directly in.
 */
export async function relationsForSpaces(
  caller: V2Caller,
  targets: number[],
  levelOf: (web3SpaceId: number) => number | undefined,
  { db }: DbConfig,
): Promise<Map<number, SpaceRelation>> {
  const out = new Map<number, SpaceRelation>();
  const address = caller.kind === 'user' ? caller.address : null;
  const signedIn = Boolean(address);
  for (const id of targets) out.set(id, { ...NO_RELATION, signedIn });
  if (!address) return out;

  const needsFacts = targets.some((id) => (levelOf(id) ?? 0) >= 2);
  if (!needsFacts) return out;

  const facts = await getViewerFacts(address);
  if (!facts) return out; // unreadable viewer facts: fail closed (levels 0-1 only)

  const level2NotDirect: number[] = [];
  for (const id of targets) {
    if (facts.directSpaceIds.has(id)) {
      out.set(id, { ...out.get(id)!, direct: true });
    } else if (levelOf(id) === 2) {
      level2NotDirect.push(id);
    }
  }
  if (level2NotDirect.length === 0) return out;

  // Organisation siblings (DB grouping, one read).
  const roots = await loadOrganisationRoots(db);
  const directRoots = new Set<number>();
  for (const id of facts.directSpaceIds) {
    const root = roots.get(id);
    if (root !== undefined) directRoots.add(root);
  }
  const stillOpen: number[] = [];
  for (const id of level2NotDirect) {
    const root = roots.get(id);
    // A sibling means ANOTHER space of the same organisation; the target itself
    // is not direct here, so any direct space in the same tree qualifies.
    if (root !== undefined && directRoots.has(root)) {
      out.set(id, { ...out.get(id)!, orgSibling: true });
    } else {
      stillOpen.push(id);
    }
  }

  // Member of a member-space: viewer's member-space executor is among the
  // target's members (org-level, never space-level).
  if (stillOpen.length > 0 && facts.memberSpaceExecutors.size > 0) {
    const members = await getSpaceMembers(stillOpen);
    for (const id of stillOpen) {
      const list = members.get(id)?.members ?? [];
      if (list.some((m) => facts.memberSpaceExecutors.has(m))) {
        out.set(id, { ...out.get(id)!, memberSpaceParticipant: true });
      }
    }
  }
  return out;
}

/**
 * The server-side answer to "which of these spaces may this viewer see".
 * Returns only the visible spaces plus the levels read (reused for the
 * `visibility` block, which is caller-independent). A space whose level cannot
 * be read, or that has no on-chain id (no level to evaluate), is NOT listed.
 */
export async function filterSpacesForViewer<
  T extends { web3SpaceId?: number | null },
>(
  spaces: T[],
  caller: V2Caller,
  config: DbConfig,
): Promise<{ visible: T[]; levels: Map<number, SpaceVisibility> }> {
  const ids = spaces
    .map((s) => s.web3SpaceId)
    .filter((id): id is number => typeof id === 'number');
  const levels = await getSpaceLevels(ids);
  const relations = await relationsForSpaces(
    caller,
    [...levels.keys()],
    (id) => levels.get(id)?.discoverability,
    config,
  );

  const visible = spaces.filter((space) => {
    const id = space.web3SpaceId;
    if (typeof id !== 'number') return false;
    const level = levels.get(id);
    if (!level) return false;
    return isLevelSatisfied(
      level.discoverability,
      relations.get(id) ?? NO_RELATION,
    );
  });
  return { visible, levels };
}
