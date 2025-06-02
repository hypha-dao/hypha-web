import {
  PaginationMetadata,
  PaginationParams,
  AssetItem,
} from '@hypha-platform/graphql/rsc';

export function paginate(
  assets: AssetItem[],
  {
    page = 1,
    pageSize = 2,
    filter,
  }: PaginationParams<AssetItem>
): { assets: AssetItem[], pagination: PaginationMetadata } {
  const filtered = filter?.status
    ? assets.filter(asset => asset.status === filter.status)
    : assets;

  const totalPages = Math.ceil(filtered.length / pageSize)
  const meta = {
    total: filtered.length,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  }

  const start = (page - 1) * pageSize;
  return {
    assets: filtered.slice(start, start + pageSize),
    pagination: meta,
  }
}
