export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface SortOptions<T> {
  field: keyof T;
  direction: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
