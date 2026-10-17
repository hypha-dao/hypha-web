import 'server-only';

import type { DbConfig } from '../../server';
import { buildPaginatedResponse } from '../../common/pagination';
import type { PaginationMetadata } from '../../common/types';
import {
  findSpaceBySlug,
  findSpaceHostFieldsBySlug,
} from '../../space/server/queries';
import { getAllSpaces } from '../../space/server/web3/get-all-spaces';
import { getSpacesBySlugs } from '../../space/server/web3/get-spaces-by-slugs';
import { getSpacesByWeb3Ids } from '../../space/server/web3/get-spaces-by-web3-ids';
import { isSpaceArchived } from '../../space/utils';
import type { Space } from '../../space/types';
import {
  SPACE_INCLUDE_BLOCKS,
  SPACES_LIST_INCLUDE_BLOCKS,
  parseInclude,
} from '../include';
import { authorizeSpaceRead, type V2Caller, type V2Failure } from './access';
import { filterSpacesForViewer } from './viewer-access';
import {
  readChainClock,
  readSpaceGovernanceBatch,
  readSpaceVisibilityBatch,
  type SpaceGovernance,
  type SpaceVisibility,
} from './chain-reads';

export type V2BadRequest = {
  ok: false;
  status: 400;
  error: string;
  message?: string;
};

function badInclude(
  unknown: string[],
  allowed: readonly string[],
): V2BadRequest {
  return {
    ok: false,
    status: 400,
    error: 'Unknown include block',
    message: `Unknown include: ${unknown.join(', ')}. Allowed: ${allowed.join(
      ', ',
    )}.`,
  };
}

type GovernanceBlock = Omit<SpaceGovernance, 'memberCount'>;

function toGovernanceBlock(g: SpaceGovernance): GovernanceBlock {
  const { memberCount: _memberCount, ...rest } = g;
  return rest;
}

function toVisibilityBlock(v: SpaceVisibility) {
  return { discoverability: v.discoverability, access: v.access };
}

export type SpacesListQuery = {
  web3SpaceIds?: number[];
  slugs?: string[];
  parentOnly?: boolean;
  omitArchived?: boolean;
  omitSandbox?: boolean;
  /** Both absent = the full list, as v1. */
  page?: number;
  pageSize?: number;
  include?: string | null;
};

export type SpacesListV2 = {
  /**
   * v1 `Space` items plus requested blocks. Intentional omission:
   * `memberAddresses` (no wallet-address arrays in v2; use `memberCount` and
   * `memberships/me`).
   */
  data: Array<
    Omit<Space, 'memberAddresses'> & {
      visibility?: ReturnType<typeof toVisibilityBlock> | null;
      governance?: GovernanceBlock | null;
    }
  >;
  /** `null` when neither `page` nor `pageSize` was sent (full list). */
  pagination: PaginationMetadata | null;
  asOf: string;
  asOfBlock: number | null;
};

/**
 * Same three-way source selection as the v1 route (`web3SpaceIds`, `slugs`,
 * else all), through the same core functions, so v1 items are unchanged.
 */
async function listV1Spaces(query: SpacesListQuery): Promise<Space[]> {
  const options =
    query.parentOnly !== undefined
      ? { parentOnly: query.parentOnly }
      : undefined;
  if (query.web3SpaceIds) {
    return getSpacesByWeb3Ids(query.web3SpaceIds, options);
  }
  if (query.slugs) {
    return getSpacesBySlugs(query.slugs, options);
  }
  return getAllSpaces({
    parentOnly: query.parentOnly,
    omitArchived: query.omitArchived,
    omitSandbox: query.omitSandbox,
  });
}

/**
 * Viewer-aware list: the server applies the four-level discoverability rule
 * for the token holder and returns ONLY the spaces the viewer may see (guests:
 * level 0). There is no unfiltered mode. The items depend on the viewer; the
 * `include=` blocks on each item do not.
 */
export async function buildSpacesListV2(
  query: SpacesListQuery,
  caller: V2Caller,
  { db }: DbConfig,
): Promise<{ ok: true; body: SpacesListV2 } | V2BadRequest> {
  const include = parseInclude(query.include, SPACES_LIST_INCLUDE_BLOCKS);
  if (!include.ok) return badInclude(include.unknown, include.allowed);

  let spaces = await listV1Spaces(query);

  // The omit filters are applied on every source (v1 only honours them for the
  // default one); they are idempotent where the source already applied them.
  if (query.omitArchived) {
    spaces = spaces.filter((space) => !isSpaceArchived(space));
  }
  if (query.omitSandbox) {
    spaces = spaces.filter(
      (space) => !space.flags?.includes('sandbox' as never),
    );
  }

  // Filter BEFORE paginating so totals and pages describe what the viewer may see.
  const { visible, levels: visibility } = await filterSpacesForViewer(
    spaces,
    caller,
    { db },
  );
  spaces = visible;

  const paginated = query.page !== undefined || query.pageSize !== undefined;
  let pagination: PaginationMetadata | null = null;
  if (paginated) {
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const page = Math.max(1, query.page ?? 1);
    const slice = spaces.slice((page - 1) * pageSize, page * pageSize);
    pagination = buildPaginatedResponse(
      slice,
      spaces.length,
      page,
      pageSize,
    ).pagination;
    spaces = slice;
  }

  const web3Ids = [
    ...new Set(
      spaces
        .map((s) => s.web3SpaceId)
        .filter((id): id is number => typeof id === 'number'),
    ),
  ];
  const [governance, clock] = await Promise.all([
    include.blocks.has('governance')
      ? readSpaceGovernanceBatch(web3Ids)
      : Promise.resolve(null),
    readChainClock(),
  ]);

  const data = spaces.map((space) => {
    const { memberAddresses: _omitted, ...v1Item } = space;
    void _omitted;
    const out: SpacesListV2['data'][number] = { ...v1Item };
    const id = space.web3SpaceId;
    if (include.blocks.has('visibility')) {
      const v = typeof id === 'number' ? visibility.get(id) : undefined;
      out.visibility = v ? toVisibilityBlock(v) : null;
    }
    if (governance) {
      const g = typeof id === 'number' ? governance.get(id) : undefined;
      out.governance = g ? toGovernanceBlock(g) : null;
    }
    return out;
  });

  return {
    ok: true,
    body: { data, pagination, asOf: clock.asOf, asOfBlock: clock.asOfBlock },
  };
}

export type SpaceV2 = NonNullable<
  Awaited<ReturnType<typeof findSpaceBySlug>>
> & {
  visibility?: ReturnType<typeof toVisibilityBlock> | null;
  governance?: GovernanceBlock | null;
  counts?: { memberCount: number | null };
  asOf: string;
  asOfBlock: number | null;
};

export async function buildSpaceV2(
  {
    slug,
    caller,
    include: rawInclude,
  }: { slug: string; caller: V2Caller; include?: string | null },
  { db }: DbConfig,
): Promise<
  | { ok: true; body: SpaceV2 }
  | V2BadRequest
  | V2Failure
  | { ok: false; status: 404; error: string }
> {
  const include = parseInclude(rawInclude, SPACE_INCLUDE_BLOCKS);
  if (!include.ok) return badInclude(include.unknown, include.allowed);

  // Light lookup first: the access gate must run before the heavy v1 load.
  const host = await findSpaceHostFieldsBySlug({ slug }, { db });
  if (!host) return { ok: false, status: 404, error: 'Space not found' };

  const gate = await authorizeSpaceRead(host, caller, { db });
  if (!gate.ok) return gate;

  const space = await findSpaceBySlug({ slug }, { db });
  if (!space) return { ok: false, status: 404, error: 'Space not found' };

  const id = typeof space.web3SpaceId === 'number' ? space.web3SpaceId : null;
  const wantsGovernance =
    include.blocks.has('governance') || include.blocks.has('counts');

  const [visibility, governance, clock] = await Promise.all([
    include.blocks.has('visibility') && id !== null
      ? readSpaceVisibilityBatch([id])
      : Promise.resolve(null),
    wantsGovernance && id !== null
      ? readSpaceGovernanceBatch([id])
      : Promise.resolve(null),
    readChainClock(),
  ]);

  // v1 single-space has no `memberAddresses`; strip defensively so it can
  // never appear here (explicit omission, see public-profile.ts).
  const { memberAddresses: _omitted, ...v1Space } = space as typeof space & {
    memberAddresses?: unknown;
  };
  void _omitted;
  const body: SpaceV2 = {
    ...v1Space,
    asOf: clock.asOf,
    asOfBlock: clock.asOfBlock,
  };
  if (include.blocks.has('visibility')) {
    const v = id !== null ? visibility?.get(id) : undefined;
    body.visibility = v ? toVisibilityBlock(v) : null;
  }
  const g = id !== null ? governance?.get(id) : undefined;
  if (include.blocks.has('governance')) {
    body.governance = g ? toGovernanceBlock(g) : null;
  }
  if (include.blocks.has('counts')) {
    // null = unknown (no web3 id or the chain read failed); never a silent 0.
    body.counts = { memberCount: g ? g.memberCount : null };
  }

  return { ok: true, body };
}
