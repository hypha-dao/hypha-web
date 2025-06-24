import { data } from './list.mock';

export type RequestItem = {
  avatar: string;
  name: string;
  surname: string;
  value: number;
  symbol: string;
  date: string;
};

type PaginationMetadata = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type PaginatedResponse<T> = {
  requests: T[];
  pagination: PaginationMetadata;
  totalValue: number;
};

type SortParams = {
  sort?: string;
};

type PaginationParams = {
  page?: number;
  pageSize?: number;
  sort?: SortParams;
};

export const fetchRequests = async ({
  page = 1,
  pageSize = 4,
  sort,
}: PaginationParams): Promise<PaginatedResponse<RequestItem>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      let sortedData = data;

      if (sort?.sort === 'most-recent') {
        sortedData = data.sort((a, b) => b.value - a.value);
      }

      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const requests = sortedData.slice(start, end);
      const total = sortedData.length;
      const totalPages = Math.ceil(total / pageSize);
      const totalValue = requests.reduce(
        (sum, request) => sum + (request.value || 0),
        0,
      );

      resolve({
        requests,
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        totalValue,
      });
    }, 1000);
  });
};
