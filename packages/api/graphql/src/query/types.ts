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

export type FilterParams<T> = {
  [key in keyof T]?: string;
};

export type PaginationParams<T> = {
  page?: number;
  pageSize?: number;
  filter?: FilterParams<T>;
};
