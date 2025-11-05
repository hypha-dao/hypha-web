'use client';

import React from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';

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
  createdAt?: Date;
};

type UseAssetsData = {
  assets: (Omit<AssetItem, 'createdAt'> & { createdAt?: string })[];
  isLoading: boolean;
  balance: number;
};

type UseAssetsReturn = {
  assets: AssetItem[];
  isLoading: boolean;
  balance: number;
};

export const useAssets = ({
  filter,
  refreshInterval = 10000,
}: {
  filter?: { type: string };
  refreshInterval?: number;
}): UseAssetsReturn => {
  const { id } = useParams<{ id: string }>();

  const endpoint = React.useMemo(() => {
    return `/api/v1/spaces/${id}/assets`;
  }, [id]);

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

  const typedData = data as UseAssetsData | undefined;
  const hasValidData =
    typedData &&
    Array.isArray(typedData.assets) &&
    typeof typedData.balance === 'number';

  const filteredAssets = React.useMemo(() => {
    if (!hasValidData) return [];
    const transformAsset = (asset: (typeof typedData.assets)[0]) => ({
      ...asset,
      createdAt:
        asset.createdAt && asset.createdAt.length > 0
          ? new Date(asset.createdAt)
          : undefined,
    });
    if (!filter || filter.type === 'all') {
      return typedData.assets.map(transformAsset);
    }
    return typedData.assets
      .filter((asset) => asset.type === filter.type)
      .map(transformAsset);
  }, [hasValidData, typedData?.assets, filter]);

  return {
    assets: filteredAssets,
    isLoading,
    balance: hasValidData ? typedData.balance : 0,
  };
};
