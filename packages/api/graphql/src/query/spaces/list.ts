import { data } from './list.mock';
import { SpaceType } from './types';
import { PaginationMetadata } from '../types';

type PaginatedResponse<T> = {
  spaces: T[];
  pagination: PaginationMetadata;
};

type SortParams = {
  sort?: string;
};

type PaginationParams = {
  page?: number;
  pageSize?: number;
  sort?: SortParams;
};

export const fetchSpaces = async ({
  page = 1,
  pageSize = 3,
  sort,
}: PaginationParams): Promise<PaginatedResponse<SpaceType>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      let sortedData = data;

      if (sort?.sort === 'most-recent') {
        sortedData = data.sort((a, b) => b.members.length - a.members.length);
      }

      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const spaces = sortedData.slice(start, end);
      const total = sortedData.length;
      const totalPages = Math.ceil(total / pageSize);

      resolve({
        spaces,
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
