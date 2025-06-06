import {
  PaginationMetadata,
  PaginationParams,
} from '@hypha-platform/graphql/rsc';

export function paginate<T>(
  data: T[],
  {
    page = 1,
    pageSize = 2,
    filter = {},
  }: PaginationParams<T>,
): {
  paginatedData: T[],
  pagination: PaginationMetadata
} {
  const filtered = data.filter(obj => {
    return Object.entries(filter).every(([key, value]) => {
      return value === undefined || obj[key as keyof T] === value;
    })
  });

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
    paginatedData: filtered.slice(start, start + pageSize),
    pagination: meta,
  }
}
