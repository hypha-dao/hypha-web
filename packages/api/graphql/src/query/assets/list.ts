import { data } from './list.mock';
import { AssetItem } from './types';
import { PaginationMetadata, PaginationParams } from '../types';

type PaginatedResponse<T> = {
  assets: T[];
  pagination: PaginationMetadata;
  balance?: number;
};

export const fetchAssets = async ({
  page = 1,
  pageSize = 2,
  filter,
}: PaginationParams): Promise<PaginatedResponse<AssetItem>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const filteredData = filter
        ? data.filter((asset) => asset.status === filter.status)
        : data;

      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const assets = filteredData.slice(start, end);
      const total = filteredData.length;
      const totalPages = Math.ceil(total / pageSize);
      const balance = assets.reduce(
        (sum, asset) => sum + (asset.usdEqual || 0),
        0
      );

      resolve({
        assets,
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        balance,
      });
    }, 1000);
  });
};
