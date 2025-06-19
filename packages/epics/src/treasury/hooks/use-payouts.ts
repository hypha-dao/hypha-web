'use client';

import useSWR from 'swr';
import {
  PayoutItem,
  fetchPayouts,
} from '@hypha-platform/graphql/rsc';
import { FilterParams, PaginationMetadata } from '@core/common';

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
