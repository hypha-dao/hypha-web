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

export function paginate<T>(
  data: T[],
  { page = 1, pageSize = 2, filter = {} }: PaginationParams<T>,
): PaginatedResponse<T> {
  if (page < 1) {
    page = 1;
  }
  if (pageSize < 1) {
    pageSize = 2;
  }

  const filtered = data.filter((obj) => {
    return Object.entries(filter).every(([key, value]) => {
      return value === undefined || obj[key as keyof T] === value;
    });
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const meta = {
    total: filtered.length,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };

  const start = (page - 1) * pageSize;
  return {
    data: filtered.slice(start, start + pageSize),
    pagination: meta,
  };
}
