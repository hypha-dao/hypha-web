import 'server-only';

import type { DbConfig } from '../../server';
import { decideSpaceAccess } from '../../access/policy';
import {
  readChainClock,
  readSpaceGovernanceBatch,
  readSpaceVisibilityBatch,
  type SpaceGovernance,
  type SpaceVisibility,
} from '../../access/chain-reads';
import { buildPaginatedResponse } from '../../common/pagination';
import type { PaginationMetadata } from '../../common/types';
import { listSpaces, type ListedSpace } from '../../features/list-spaces';
import {
  findSpaceBySlug,
  findSpaceHostFieldsBySlug,
} from '../../space/server/queries';
import {
  SPACE_INCLUDE_BLOCKS,
  SPACES_LIST_INCLUDE_BLOCKS,
  parseInclude,
} from '../include';
import { toV2Failure, type V2Caller, type V2Failure } from '../failure';

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
  data: ListedSpace[];
  /** `null` when neither `page` nor `pageSize` was sent (full list). */
  pagination: PaginationMetadata | null;
  asOf: string;
  asOfBlock: number | null;
};

/**
 * API presentation of the "list spaces" feature function: the viewer-aware list. The
 * feature applies the four-level discoverability rule for the token holder before paging
 * and returns ONLY the spaces the viewer may see (guests: level 0). The items depend on
 * the viewer; the  blocks on each item do not.
 */
export async function buildSpacesListV2(
  query: SpacesListQuery,
  caller: V2Caller,
  config: DbConfig,
): Promise<{ ok: true; body: SpacesListV2 } | V2BadRequest | V2Failure> {
  const include = parseInclude(query.include, SPACES_LIST_INCLUDE_BLOCKS);
  if (!include.ok) return badInclude(include.unknown, include.allowed);

  const paginated = query.page !== undefined || query.pageSize !== undefined;
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const page = Math.max(1, query.page ?? 1);

  const r = await listSpaces(
    {
      web3SpaceIds: query.web3SpaceIds,
      slugs: query.slugs,
      parentOnly: query.parentOnly,
      omitArchived: query.omitArchived,
      omitSandbox: query.omitSandbox,
      paging: paginated ? { page, pageSize } : undefined,
      with: {
        governance: include.blocks.has('governance'),
        visibility: include.blocks.has('visibility'),
      },
    },
    caller,
    config,
  );
  if (!r.ok) return toV2Failure(r);

  const { items, total, asOf, asOfBlock } = r.data;
  return {
    ok: true,
    body: {
      data: items,
      pagination: paginated
        ? buildPaginatedResponse(items, total, page, pageSize).pagination
        : null,
      asOf,
      asOfBlock,
    },
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

  const decision = await decideSpaceAccess(host, caller, { db });
  if (decision.outcome === 'none') return toV2Failure(decision.failure);

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
