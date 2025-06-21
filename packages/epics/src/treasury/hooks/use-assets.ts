'use client';

import React from 'react';
import useSWR from 'swr';
import queryString from 'query-string';
import { FilterParams } from '@core/common/server';
import { useParams } from 'next/navigation';
import { PaginationMetadata } from '@core/common';

type OneChartPoint = {
  month: string;
  value: number;
  date: string;
};

type TransactionCardProps = {
  id: string;
  title: string;
  description: string;
  amount: number;
  withUsdSymbol?: boolean;
  badges: {
    label: string;
    variant: 'solid' | 'soft' | 'outline' | 'surface';
  }[];
  author: {
    name: string;
    surname: string;
  };
  isLoading?: boolean;
  viewCount?: number;
  commentCount?: number;
};

type AssetItem = {
  icon: string;
  name: string;
  symbol: string;
  value: number;
  usdEqual: number;
  status: string;
  chartData: OneChartPoint[];
  transactions: TransactionCardProps[];
  closeUrl: string;
  slug: string;
};

type UseAssetsReturn = {
  assets: AssetItem[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
  balance: number;
};

export const useAssets = ({
  page = 1,
  pageSize = 2,
  filter,
  refreshInterval = 10000,
}: {
  page?: number;
  pageSize?: number;
  filter?: FilterParams<AssetItem>;
  refreshInterval?: number;
}): UseAssetsReturn => {
  const { id } = useParams<{ id: string }>();
  const queryParams = React.useMemo(() => {
    const effectiveFilter = {
      page,
      pageSize,
      ...filter,
    };
    return `?${queryString.stringify(effectiveFilter)}`;
  }, [page, pageSize, filter]);

  const endpoint = React.useMemo(() => {
    return `/api/v1/spaces/${id}/assets${queryParams}`;
  }, [id, queryParams]);

  const { data, isLoading } = useSWR(
    [endpoint],
    async ([endpoint]) => {
      const res = await fetch(endpoint, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch assets: ${res.statusText}`);
      }
      return await res.json();
    },
    { refreshInterval },
  );

  const typedData = data as UseAssetsReturn | undefined;
  const hasValidData =
    typedData &&
    Array.isArray(typedData.assets) &&
    typeof typedData.balance === 'number';

  return {
    assets: hasValidData ? typedData.assets : [],
    pagination: hasValidData ? typedData.pagination : undefined,
    isLoading,
    balance: hasValidData ? typedData.balance : 0,
  };
};
