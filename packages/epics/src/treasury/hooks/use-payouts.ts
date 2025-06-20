'use client';

import useSWR from 'swr';
import { FilterParams, PaginationMetadata } from '@core/common';
import { data } from './use-payouts.mock';

export type PayoutItem = {
  avatar: string;
  name: string;
  surname: string;
  value: number;
  symbol: string;
  date: string;
  status: string;
};

type PaginatedResponse<T> = {
  payouts: T[];
  pagination: PaginationMetadata;
  totalValue?: number;
};

type PaginationFilterParams = {
  status?: string;
};

type PaginationParams = {
  page?: number;
  pageSize?: number;
  filter?: PaginationFilterParams;
};

const fetchPayouts = async ({
  page = 1,
  pageSize = 4,
  filter,
}: PaginationParams): Promise<PaginatedResponse<PayoutItem>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const filteredData = filter
        ? data.filter((payout) => payout.status === filter.status)
        : data;

      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const payouts = filteredData.slice(start, end);
      const total = filteredData.length;
      const totalPages = Math.ceil(total / pageSize);
      const totalValue = payouts.reduce(
        (sum, payout) => sum + (payout.value || 0),
        0,
      );

      resolve({
        payouts,
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        totalValue,
      });
    }, 1000);
  });
};

type UsePayoutsReturn = {
  payouts: PayoutItem[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
  total: number;
};

export const usePayouts = ({
  page = 1,
  filter,
}: {
  page?: number;
  filter?: FilterParams<PayoutItem>;
}): UsePayoutsReturn => {
  const { data, isLoading } = useSWR(['payouts', page, filter], () =>
    fetchPayouts({ page, filter }),
  );

  return {
    payouts: data?.payouts || [],
    pagination: data?.pagination,
    isLoading,
    total: data?.totalValue || 0,
  };
};
