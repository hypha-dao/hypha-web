'use client';

import {
  buildSpaceMemoryItemsFromDocuments,
  filterSpaceMemoryItems,
  type SpaceMemoryItem,
} from '@hypha-platform/core/client';
import type { Document } from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import queryString from 'query-string';
import React from 'react';
import useSWR from 'swr';

type DocumentDto = Omit<Document, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

const queryParams = `?${queryString.stringify({
  order: '-updatedAt',
})}`;

export function useSpaceMemoryOrg(spaceSlug: string | undefined) {
  const { getAccessToken } = useAuthentication();

  const endpoint = React.useMemo(
    () =>
      spaceSlug
        ? `/api/v1/spaces/${spaceSlug}/documents/all${queryParams}`
        : null,
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
        throw new Error(`Failed to fetch documents: ${res.status}`);
      }
      const payload = (await res.json()) as DocumentDto[];
      return payload.map((doc) => ({
        ...doc,
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt),
      })) as Document[];
    },
    {
      revalidateOnFocus: true,
      refreshInterval: 60_000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    },
  );

  const items = React.useMemo(() => {
    if (!data || !Array.isArray(data)) return [] as SpaceMemoryItem[];
    return buildSpaceMemoryItemsFromDocuments(data);
  }, [data]);

  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredItems = React.useMemo(
    () => filterSpaceMemoryItems(items, searchTerm),
    [items, searchTerm],
  );

  return {
    items: filteredItems,
    totalCount: items.length,
    isLoading,
    error,
    refresh: mutate,
    searchTerm,
    setSearchTerm,
  };
}
