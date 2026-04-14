'use client';

import {
  buildSpaceMemoryItemsFromOrgMemoryPayload,
  type OrgMemorySpaceMemoryPayload,
  type SpaceMemoryItem,
} from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import queryString from 'query-string';
import React from 'react';
import useSWRInfinite from 'swr/infinite';

const ASSETS_PAGE_SIZE = 12;

type SpaceMemoryFetcherKey = readonly [
  'space-memory-org',
  string,
  number,
  number,
  string,
];

export function useSpaceMemoryOrg(spaceSlug: string | undefined) {
  const { getAccessToken } = useAuthentication();
  const [searchTerm, setSearchTerm] = React.useState('');
  const searchKey = searchTerm.trim();

  const getKey = React.useCallback(
    (
      pageIndex: number,
      previousPageData: OrgMemorySpaceMemoryPayload | null,
    ) => {
      if (!spaceSlug) return null;
      if (
        pageIndex > 0 &&
        previousPageData &&
        !previousPageData.assets_pagination?.has_next_page
      ) {
        return null;
      }
      return [
        'space-memory-org',
        spaceSlug,
        pageIndex + 1,
        ASSETS_PAGE_SIZE,
        searchKey,
      ] as const;
    },
    [spaceSlug, searchKey],
  );

  const { data, error, isLoading, isValidating, mutate, size, setSize } =
    useSWRInfinite(
      getKey,
      async (key: SpaceMemoryFetcherKey) => {
        const [, slug, assetsPage, assetsPageSize, search] = key;
        const qs = queryString.stringify({
          assets_page: assetsPage,
          assets_page_size: assetsPageSize,
          ...(search ? { assets_search: search } : {}),
        });
        const url = `/api/v1/spaces/${slug}/org-memory?${qs}`;
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

  React.useEffect(() => {
    void setSize(1);
  }, [searchKey, setSize]);

  const items = React.useMemo(() => {
    if (!data?.length) return [] as SpaceMemoryItem[];
    return data.flatMap((page) =>
      buildSpaceMemoryItemsFromOrgMemoryPayload(page),
    );
  }, [data]);

  const totalCount = React.useMemo(() => {
    const first = data?.[0];
    const fromPagination = first?.assets_pagination?.total;
    if (typeof fromPagination === 'number' && fromPagination >= 0) {
      return fromPagination;
    }
    return items.length;
  }, [data, items.length]);

  const hasMore = Boolean(
    data?.length && data[data.length - 1]?.assets_pagination?.has_next_page,
  );

  const loadMore = React.useCallback(() => {
    if (!hasMore || isValidating) return;
    void setSize((n) => n + 1);
  }, [hasMore, isValidating, setSize]);

  const refresh = React.useCallback(() => mutate(), [mutate]);

  const listError = !data?.length ? error : undefined;
  const loadMoreError = data && data.length > 0 ? error : undefined;

  return {
    items,
    totalCount,
    isLoading: Boolean(isLoading && !data?.length),
    isLoadingMore: Boolean(isValidating && data && data.length > 0),
    error: listError,
    loadMoreError,
    refresh,
    searchTerm,
    setSearchTerm,
    hasMore,
    loadMore,
  };
}
