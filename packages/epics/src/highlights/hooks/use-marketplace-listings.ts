'use client';

import useSWR from 'swr';
import type {
  MarketplaceListingItem,
  PaginatedResponse,
} from '@hypha-platform/core/client';

async function fetchMarketplace(
  page: number,
): Promise<PaginatedResponse<MarketplaceListingItem>> {
  const res = await fetch(
    `/api/v1/network/marketplace?page=${page}&pageSize=24`,
  );
  if (!res.ok) {
    throw new Error('Failed to load marketplace');
  }
  return res.json();
}

export function useMarketplaceListings(enabled: boolean) {
  const { data, error, isLoading, mutate } = useSWR(
    enabled ? ['network-marketplace', 1] : null,
    ([, page]) => fetchMarketplace(page as number),
  );

  return {
    items: data?.data ?? [],
    pagination: data?.pagination,
    error,
    isLoading,
    mutate,
  };
}
