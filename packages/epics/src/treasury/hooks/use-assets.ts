'use client';

import React from 'react';
import useSWR from 'swr';
import { AssetItem } from '@hypha-platform/graphql/rsc';
import { useParams } from 'next/navigation';

type UseAssetsReturn = {
  assets: AssetItem[];
  isLoading: boolean;
  balance: number;
};

export const useAssets = ({
  filter,
  refreshInterval = 10000,
}: {
  filter?: { status: string };
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

  const typedData = data as UseAssetsReturn | undefined;
  const hasValidData =
    typedData &&
    Array.isArray(typedData.assets) &&
    typeof typedData.balance === 'number';

  const filteredAssets = React.useMemo(() => {
    if (!hasValidData) return [];
    if (!filter || filter.status === 'all') return typedData.assets;
    return typedData.assets.filter((asset) => asset.status === filter.status);
  }, [hasValidData, typedData?.assets, filter]);

  return {
    assets: filteredAssets,
    isLoading,
    balance: hasValidData ? typedData.balance : 0,
  };
};
