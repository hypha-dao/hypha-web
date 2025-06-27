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

export enum DirectionType {
  ASC = 'asc',
  DESC = 'desc',
}

export type OrderField<T> = {
  name: keyof T;
  dir: DirectionType;
};

export type Order<T> = Array<OrderField<T>>;

export type PaginationParams<T> = {
  page?: number;
  pageSize?: number;
  filter?: FilterParams<T>;
  order?: Order<T>;
};
