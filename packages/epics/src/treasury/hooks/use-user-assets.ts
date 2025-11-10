'use client';

import React from 'react';
import useSWR from 'swr';
import { useJwt } from '@hypha-platform/core/client';

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
  type: string;
  chartData: OneChartPoint[];
  transactions: TransactionCardProps[];
  closeUrl: string;
  slug: string;
  address: string;
};

type UseAssetsReturn = {
  assets: AssetItem[];
  isLoading: boolean;
  balance: number;
  manualUpdate: () => Promise<void>;
};

export const useUserAssets = ({
  filter,
  refreshInterval = 10000,
  personSlug,
}: {
  filter?: { type: string };
  refreshInterval?: number;
  personSlug?: string;
}): UseAssetsReturn => {
  const { jwt } = useJwt();
  const endpoint = React.useMemo(() => {
    return `/api/v1/people/${personSlug}/assets`;
  }, [personSlug]);

  const { data, isLoading, mutate } = useSWR(
    jwt ? [endpoint, jwt] : null,
    ([endpoint, jwt]) =>
      fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }).then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch user assets: ${res.statusText}`);
        }
        return await res.json();
      }),
    { refreshInterval },
  );

  const typedData = data as UseAssetsReturn | undefined;
  const hasValidData =
    typedData &&
    Array.isArray(typedData.assets) &&
    typeof typedData.balance === 'number';

  const filteredAssets = React.useMemo(() => {
    if (!hasValidData) return [];
    if (!filter || filter.type === 'all') return typedData.assets;
    return typedData.assets.filter((asset) => asset.type === filter.type);
  }, [hasValidData, typedData?.assets, filter]);

  return {
    assets: filteredAssets,
    isLoading,
    balance: hasValidData ? typedData.balance : 0,
    manualUpdate: mutate,
  };
};
