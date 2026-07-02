import type { PaginatedResponse, PaginationMetadata } from './types';

export function parseHttpPaginationParams(
  url: URL,
  { defaultPageSize = 100, maxPageSize = 500 } = {},
): { page: number; pageSize: number; offset: number } {
  const page = Math.max(
    1,
    Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1,
  );
  const pageSize = Math.min(
    maxPageSize,
    Math.max(
      1,
      Number.parseInt(
        url.searchParams.get('pageSize') ?? String(defaultPageSize),
        10,
      ) || defaultPageSize,
    ),
  );
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const pagination: PaginationMetadata = {
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage: totalPages > 0 && page < totalPages,
    hasPreviousPage: totalPages > 0 && page > 1,
  };
  return { data, pagination };
}
