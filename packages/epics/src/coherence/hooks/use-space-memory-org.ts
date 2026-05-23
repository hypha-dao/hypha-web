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
import { mutate } from 'swr';

const ASSETS_PAGE_SIZE = 12;

export const SPACE_MEMORY_ORG_SWR_KEY = 'space-memory-org' as const;

type SpaceMemoryFetcherKey = readonly [
  typeof SPACE_MEMORY_ORG_SWR_KEY,
  string,
  number,
  number,
  string,
];

/** Revalidate all org-memory list pages for a space (e.g. after publishing a memory). */
export function revalidateSpaceMemoryOrg(spaceSlug: string) {
  return mutate(
    (key: unknown) =>
      Array.isArray(key) &&
      key[0] === SPACE_MEMORY_ORG_SWR_KEY &&
      key[1] === spaceSlug,
    undefined,
    { revalidate: true },
  );
}

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
        SPACE_MEMORY_ORG_SWR_KEY,
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
          assets_view: 'full',
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
        revalidateOnFocus: false,
        revalidateIfStale: true,
        refreshInterval: 120_000,
        refreshWhenHidden: false,
        refreshWhenOffline: false,
        keepPreviousData: true,
      },
    );

  React.useEffect(() => {
    void setSize(1);
  }, [searchKey, setSize]);

  const loadedPages =
    data?.filter((page): page is OrgMemorySpaceMemoryPayload =>
      Boolean(page),
    ) ?? [];
  const lastLoadedPage = loadedPages[loadedPages.length - 1];

  const items = React.useMemo(() => {
    return loadedPages.flatMap((page) =>
      buildSpaceMemoryItemsFromOrgMemoryPayload(page),
    );
  }, [loadedPages]);

  const totalCount = React.useMemo(() => {
    const fromPagination = loadedPages[0]?.assets_pagination?.total;
    if (typeof fromPagination === 'number' && fromPagination >= 0) {
      return fromPagination;
    }
    return items.length;
  }, [loadedPages, items.length]);

  const hasMore = Boolean(lastLoadedPage?.assets_pagination?.has_next_page);

  const loadMore = React.useCallback(() => {
    if (!hasMore || isValidating) return;
    void setSize((n) => n + 1);
  }, [hasMore, isValidating, setSize]);

  const refresh = React.useCallback(() => mutate(), [mutate]);

  const loadedPageCount = loadedPages.length;
  const listError = loadedPageCount === 0 ? error : undefined;
  const loadMoreError =
    loadedPageCount > 0 && Boolean(error) && size > loadedPageCount
      ? error
      : undefined;

  return {
    items,
    totalCount,
    isLoading: Boolean(isLoading && loadedPageCount === 0),
    isLoadingMore: Boolean(isValidating && size > loadedPageCount),
    error: listError,
    loadMoreError,
    refresh,
    searchTerm,
    setSearchTerm,
    hasMore,
    loadMore,
  };
}
