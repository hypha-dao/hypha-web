export enum DirectionType {
  ASC = 'asc',
  DESC = 'desc',
}

export type OrderField<T> = {
  name: keyof T;
  dir: DirectionType;
};

export type Order<T> = Array<OrderField<T>>;

export type FilterParams<T> = {
  [key in keyof T]?: string;
};

export type PaginationParams<T> = {
  page?: number;
  pageSize?: number;
  filter?: FilterParams<T>;
  order?: Order<T>;
  offset?: number;
};
