import type { PaginatedResponse } from '@hypha-platform/core/client';

/**
 * Paginates a list for the members HTTP API (separate lists for people vs spaces).
 */
export function paginateSpaceMembersForHttp<T>(
  items: T[],
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  const total = items.length;
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const totalPages = total === 0 ? 0 : Math.ceil(total / safePageSize);
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * safePageSize;
  const data = items.slice(offset, offset + safePageSize);

  return {
    data,
    pagination: {
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages,
      hasNextPage: totalPages > 0 && safePage < totalPages,
      hasPreviousPage: totalPages > 0 && safePage > 1,
    },
  };
}
