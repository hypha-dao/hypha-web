import { data } from './list.mock';
import { DiscussionItem, PaginationParams, PaginatedResponse } from './types';

export const fetchDiscussions = async ({
  page = 1,
  pageSize = 3,
  filter,
}: PaginationParams): Promise<PaginatedResponse<DiscussionItem>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const filteredData = filter
        ? data.filter((discussion) => discussion.status === filter.status)
        : data;

      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const discussions = filteredData.slice(start, end);
      const total = filteredData.length;
      const totalPages = Math.ceil(total / pageSize);

      resolve({
        discussions,
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    }, 200);
  });
};
