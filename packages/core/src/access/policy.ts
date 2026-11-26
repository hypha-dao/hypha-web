import 'server-only';

import type { DbConfig } from '../server';
import type { Caller } from './caller';
import { failure, type Failure } from './failure';
import { authorizeSpaceRead } from './space-read-gate';
import { filterSpacesForViewer } from './viewer-access';
import type { SpaceVisibility } from './chain-reads';

/**
 * The access policy (G1): the ONE place that decides how much of a space a caller may
 * see. Every feature function asks it before it fetches content, and lists are filtered
 * through it before paging and before any aggregate.
 *
 * It composes, in this order, and the strictest answer wins:
 *   1. the per-space GRANTS the person gave this client (`caller.via.spaceGrants`;
 *      `null` = no restriction beyond the person's own rights);
 *   2. the on-chain id rule: a caller that arrived through the authorization server
 *      (`via` set) is refused spaces with no on-chain id, because they have no access level
 *      to evaluate (fail closed). The API's own callers keep v1's behaviour;
 *   3. the TRANSPARENCY MATRIX (the existing four-level rule: PUBLIC, NETWORK,
 *      ORGANISATION, SPACE);
 *   4. later, the CHANNEL level (K54, #2558): which clients may list a space.
 *
 * Three outcomes: `full`, `minimal`, `none`. The default is `none`: anything the policy
 * cannot establish is refused. `minimal` is reserved for a named feature function with an
 * explicit field allowlist and a documented reason; no feature in this release returns it.
 */
export type AccessOutcome = 'full' | 'minimal' | 'none';

export type SpaceAccessDecision =
  | { outcome: 'full' | 'minimal' }
  | { outcome: 'none'; failure: Failure };

type SpaceRef = { id: number; web3SpaceId: number | null | undefined };

const DENY: SpaceAccessDecision = {
  outcome: 'none',
  failure: failure('not_found', 'Space not found'),
};

/** True when the caller came through the authorization server and is held to the strict rules. */
export function isGrantAwareCaller(caller: Caller): boolean {
  return caller.kind === 'user' && caller.via !== undefined;
}

/**
 * True only when the caller came through the authorization server and its token carries `scope`.
 * Fail closed: a caller without `via` (a guest, or the API's own bearer) holds no OAuth scope and
 * is refused. A write checks this AND the space grant AND the person's own rights; never use
 * `grantsAllow` alone for a write, it allows callers without `via`.
 */
export function hasScope(caller: Caller, scope: string): boolean {
  return (
    caller.kind === 'user' &&
    caller.via !== undefined &&
    caller.via.scopes.includes(scope)
  );
}

function grantsAllow(caller: Caller, spaceId: number): boolean {
  if (caller.kind !== 'user' || !caller.via) return true;
  const grants = caller.via.spaceGrants;
  return grants === null || grants.includes(spaceId);
}

/**
 * Decide access to one space.
 * `matrix: false` skips the transparency matrix for features whose answer is about the
 * caller (a membership read for the API), while grants and the on-chain id rule still apply.
 */
export async function decideSpaceAccess(
  space: SpaceRef,
  caller: Caller,
  config: DbConfig,
  options: { matrix?: boolean } = {},
): Promise<SpaceAccessDecision> {
  if (!grantsAllow(caller, space.id)) return DENY;
  if (isGrantAwareCaller(caller) && space.web3SpaceId == null) return DENY;
  if (options.matrix === false) return { outcome: 'full' };

  const gate = await authorizeSpaceRead(space, caller, config);
  if (gate.ok) return { outcome: 'full' };
  return { outcome: 'none', failure: gate };
}

/**
 * Filter a list of spaces for a caller. Grants first, then the matrix (which already drops
 * spaces with no on-chain id or an unreadable level). Run BEFORE paging and aggregates.
 */
export async function filterSpacesForCaller<
  T extends { id: number; web3SpaceId?: number | null },
>(
  spaces: T[],
  caller: Caller,
  config: DbConfig,
): Promise<{
  visible: T[];
  levels: Map<number, SpaceVisibility>;
  /** True when spaces were considered but NO access level could be read: the list is not
   *  "empty", the check failed (and everything stayed hidden). */
  levelsUnreadable: boolean;
}> {
  const considered = spaces.filter((space) => grantsAllow(caller, space.id));
  const result = await filterSpacesForViewer(considered, caller, config);
  const withChainId = considered.filter(
    (space) => typeof space.web3SpaceId === 'number',
  ).length;
  return {
    ...result,
    levelsUnreadable: withChainId > 0 && result.levels.size === 0,
  };
}
