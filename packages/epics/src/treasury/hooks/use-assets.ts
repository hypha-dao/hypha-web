'use client';

import React from 'react';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { useAuthentication } from '@hypha-platform/authentication';

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
  tokenPrice?: number;
  referenceCurrency?: string | null;
  usdEqual: number;
  type: string;
  chartData: OneChartPoint[];
  transactions: TransactionCardProps[];
  closeUrl: string;
  slug: string;
  address: string;
  createdAt?: Date;
  /** True when this space issued the token — keep visible at 0 balance. */
  issuedBySpace?: boolean;
  space?: {
    slug: string;
    title: string;
  };
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
  bestEffort = false,
}: {
  filter?: { type: string };
  refreshInterval?: number;
  bestEffort?: boolean;
}): UseAssetsReturn => {
  const { id } = useParams<{ id: string }>();
  const { getAccessToken } = useAuthentication();

  const endpoint = React.useMemo(() => {
    return `/api/v1/spaces/${id}/assets${bestEffort ? '?bestEffort=true' : ''}`;
  }, [bestEffort, id]);

  const { data, isLoading } = useSWR(
    [endpoint],
    async ([endpoint]) => {
      const token = await getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(endpoint, { headers });
      if (!res.ok) {
        if (bestEffort) {
          return { assets: [], isLoading: false, balance: 0 };
        }
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
