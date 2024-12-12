import { data } from './list.mock';

export type MemberType = {
  avatar: string;
  name: string;
  surname: string;
};

export type InnerSpaceType = {
  image: string;
  title: string;
  description: string;
  members: MemberType[];
  joinedStatus: boolean;
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
  innerSpaces: T[];
  pagination: PaginationMetadata;
};

type SortParams = {
  sort?: 'all' | 'most-recent';
};

type PaginationParams = {
  page?: number;
  pageSize?: number;
  sort?: SortParams;
};

export const fetchInnerSpaces = async ({
  page = 1,
  pageSize = 3,
  sort,
}: PaginationParams): Promise<PaginatedResponse<InnerSpaceType>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      let sortedData = data;

      if (sort?.sort === 'most-recent') {
        sortedData = data.sort((a, b) => b.members.length - a.members.length);
      }

      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const innerSpaces = sortedData.slice(start, end);
      const total = sortedData.length;
      const totalPages = Math.ceil(total / pageSize);

      resolve({
        innerSpaces,
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
