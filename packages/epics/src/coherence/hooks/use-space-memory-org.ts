'use client';

import {
  buildSpaceMemoryItemsFromOrgMemoryPayload,
  filterSpaceMemoryItems,
  type OrgMemorySpaceMemoryPayload,
  type SpaceMemoryItem,
} from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import queryString from 'query-string';
import React from 'react';
import useSWR from 'swr';

const ASSETS_PAGE_SIZE = 100;

const queryParams = `?${queryString.stringify({
  assetsPage: 1,
  assetsPageSize: ASSETS_PAGE_SIZE,
})}`;

export function useSpaceMemoryOrg(spaceSlug: string | undefined) {
  const { getAccessToken } = useAuthentication();

  const endpoint = React.useMemo(
    () =>
      spaceSlug ? `/api/v1/spaces/${spaceSlug}/org-memory${queryParams}` : null,
    [spaceSlug],
  );

  const { data, error, isLoading, mutate } = useSWR(
    endpoint ? ['space-memory-org', endpoint] : null,
    async ([, url]: [string, string]) => {
      const token = await getAccessToken();
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch org memory: ${res.status}`);
      }
      return (await res.json()) as OrgMemorySpaceMemoryPayload;
    },
    {
      revalidateOnFocus: true,
      refreshInterval: 60_000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    },
  );

  const items = React.useMemo(() => {
    if (!data?.org_memory_assets) return [] as SpaceMemoryItem[];
    return buildSpaceMemoryItemsFromOrgMemoryPayload(data);
  }, [data]);

  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredItems = React.useMemo(
    () => filterSpaceMemoryItems(items, searchTerm),
    [items, searchTerm],
  );

  const totalAssetCount = React.useMemo(() => {
    const fromPagination = data?.assets_pagination?.total;
    if (typeof fromPagination === 'number' && fromPagination >= 0) {
      return fromPagination;
    }
    return items.length;
  }, [data?.assets_pagination?.total, items.length]);

  return {
    items: filteredItems,
    totalCount: totalAssetCount,
    isLoading,
    error,
    refresh: mutate,
    searchTerm,
    setSearchTerm,
  };
}
