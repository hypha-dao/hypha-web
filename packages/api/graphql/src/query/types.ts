export type PaginationMetadata = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: PaginationMetadata;
};

export type FilterParams = {
  status?: string;
};

export type PaginationParams = {
  page?: number;
  pageSize?: number;
  filter?: FilterParams;
};
