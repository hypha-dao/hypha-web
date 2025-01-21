'use client';

import useSWR from 'swr';
import {
  AssetItem,
  PaginationMetadata,
  FilterParams,
  fetchAssets,
} from '@hypha-platform/graphql/rsc';

type UseAssetsReturn = {
  assets: AssetItem[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
  balance: number;
};

export const useAssets = ({
  page = 1,
  filter,
}: {
  page?: number;
  filter?: FilterParams;
}): UseAssetsReturn => {
  const { data, isLoading } = useSWR(['assets', page, filter], () =>
    fetchAssets({ page, filter })
  );

  return {
    assets: data?.assets || [],
    pagination: data?.pagination,
    isLoading,
    balance: data?.balance || 0,
  };
};
