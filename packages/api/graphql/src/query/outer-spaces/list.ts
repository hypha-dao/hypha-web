import { data } from './list.mock';

export type OuterSpaceType = {
  logo: string;
  title: string;
  description: string;
  members: number;
  projects: number;
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
  outerSpaces: T[];
  pagination: PaginationMetadata;
};

export type SortParams = {
  sort?: 'all' | 'most-recent';
};

type PaginationParams = {
  page?: number;
  pageSize?: number;
  sort?: SortParams;
};

export const fetchOuterSpaces = async ({
  page = 1,
  pageSize = 2,
  sort,
}: PaginationParams): Promise<PaginatedResponse<OuterSpaceType>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      let sortedData = data;

      if (sort?.sort === 'most-recent') {
        sortedData = data.sort((a, b) => b.projects - a.projects);
      }

      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const outerSpaces = sortedData.slice(start, end);
      const total = sortedData.length;
      const totalPages = Math.ceil(total / pageSize);

      resolve({
        outerSpaces,
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
