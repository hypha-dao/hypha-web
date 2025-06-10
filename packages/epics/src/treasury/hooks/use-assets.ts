'use client';

import React from 'react'
import useSWR from 'swr';
import queryString from 'query-string';
import {
  AssetItem,
  PaginationMetadata,
  FilterParams,
} from '@hypha-platform/graphql/rsc';

type UseAssetsReturn = {
  assets: AssetItem[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
  balance: number;
};

export const useAssets = ({
  page = 1,
  pageSize = 2,
  spaceSlug,
  filter,
}: {
  page?: number;
  pageSize?: number;
  spaceSlug?: string;
  filter?: FilterParams<AssetItem>;
}): UseAssetsReturn => {
  const queryParams = React.useMemo(() => {
    const effectiveFilter = {
      page,
      pageSize,
      ...(filter ? { filter } : {}),
    };
    return `?${queryString.stringify(effectiveFilter)}`;
  }, [page, pageSize, filter]);

  const endpoint = React.useMemo(() => {
    return `/api/v1/spaces/${spaceSlug}/assets${queryParams}`
  }, [spaceSlug, queryParams]);

  const { data, isLoading } = useSWR(
    [endpoint],
    ([endpoint]) => {
      fetch(endpoint, {
        headers: { 'Content-Type': 'application/json' },
      }).then(res => res.json())
    });

  return {
    assets: (data as UseAssetsReturn | undefined)?.assets || [],
    pagination: (data as UseAssetsReturn | undefined)?.pagination,
    isLoading,
    balance: (data as UseAssetsReturn | undefined)?.balance || 0,
  };
};
