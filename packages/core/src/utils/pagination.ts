import { PaginationParams } from '../shared';

export const getPaginationParams = (
  pagination?: PaginationParams,
  defaultPagination = { page: 1, pageSize: 10 },
) => {
  const page = pagination?.page ?? defaultPagination.page;
  const pageSize = pagination?.pageSize ?? defaultPagination.pageSize;

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
};
