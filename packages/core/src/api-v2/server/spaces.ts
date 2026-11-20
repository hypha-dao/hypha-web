import 'server-only';

import type { DbConfig } from '../../server';
import { buildPaginatedResponse } from '../../common/pagination';
import type { PaginationMetadata } from '../../common/types';
import { listSpaces, type ListedSpace } from '../../features/list-spaces';
import { SPACES_LIST_INCLUDE_BLOCKS, parseInclude } from '../include';
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
      paging: paginated
        ? { offset: (page - 1) * pageSize, limit: pageSize }
        : undefined,
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
