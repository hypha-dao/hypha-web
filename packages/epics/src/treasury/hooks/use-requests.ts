'use client';

import useSWR from 'swr';
import {
  RequestItem,
  PaginationMetadata,
  SortParams,
  fetchRequests,
} from '@hypha-platform/graphql/rsc';

type UseRequestsReturn = {
  requests: RequestItem[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
  totalValue: number;
};

export const useRequests = ({
  page = 1,
  sort,
}: {
  page?: number;
  sort?: SortParams;
}): UseRequestsReturn => {
  const { data, isLoading } = useSWR(['requests', page, sort], () =>
    fetchRequests({ page, sort })
  );

  return {
    requests: data?.requests || [],
    pagination: data?.pagination,
    isLoading,
    totalValue: data?.totalValue || 0,
  };
};
