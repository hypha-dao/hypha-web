import { data } from './list.mock';
import { MemberItem } from './types';

type PaginationMetadata = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type PaginatedResponse<T> = {
  members: T[];
  pagination: PaginationMetadata;
};

type FilterParams = {
  status?: string;
};

type PaginationParams = {
  page?: number;
  pageSize?: number;
  filter?: FilterParams;
};

export const fetchMembers = async ({
  page = 1,
  pageSize = 4,
  filter,
}: PaginationParams): Promise<PaginatedResponse<MemberItem>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const filteredData = filter
        ? data.filter((member) => member.status === filter.status)
        : data;

      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const members = filteredData.slice(start, end);
      const total = filteredData.length;
      const totalPages = Math.ceil(total / pageSize);

      resolve({
        members,
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    }, 1000);
  });
};
