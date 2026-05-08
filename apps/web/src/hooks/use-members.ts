'use client';

import React from 'react';
import useSWR, { mutate as mutateCache, type Key } from 'swr';
import queryString from 'query-string';

import { type UseMembers, type UseMembersReturn } from '@hypha-platform/epics';
import { useAuthentication } from '@hypha-platform/authentication';

type MemberItem = {
  name: string;
  surname: string;
  nickname: string;
  location: string;
  avatar: string;
  status: string;
  about: string;
  slug: string;
  isLoading?: boolean;
};

import { FilterParams } from '@hypha-platform/core/client';

export const useMembers: UseMembers = ({
  page = 1,
  pageSize = 0,
  spaceSlug,
  searchTerm,
  refreshInterval,
  paginationDisabled = false,
}: {
  page?: number;
  pageSize?: number;
  filter?: FilterParams<MemberItem>;
  spaceSlug?: string;
  searchTerm?: string;
  refreshInterval?: number;
  paginationDisabled?: boolean;
}): UseMembersReturn => {
  const { getAccessToken } = useAuthentication();
  const endpointBase = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/members`,
    [spaceSlug],
  );

  const queryParams = React.useMemo(() => {
    const effectiveFilter = paginationDisabled
      ? { ...(searchTerm ? { searchTerm } : {}) }
      : { page, pageSize, ...(searchTerm ? { searchTerm } : {}) };
    return `?${queryString.stringify(effectiveFilter)}`;
  }, [page, pageSize, searchTerm, paginationDisabled]);

  const endpoint = React.useMemo(
    () => `${endpointBase}${queryParams}`,
    [endpointBase, queryParams],
  );

  const interval = refreshInterval ?? 0;
  const keepPreviousData = !!interval;

  const {
    data: response,
    isLoading,
    mutate,
  } = useSWR(
    spaceSlug ? [endpoint] : null,
    async ([endpoint]) => {
      const token = await getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      if (!paginationDisabled) {
        return fetch(endpoint, { headers }).then((res) => res.json());
      }

      const PAGE_SIZE_ALL = 100;
      let page = 1;
      let mergedPersons: unknown[] = [];
      let mergedSpaces: unknown[] = [];
      let firstResponse: unknown = null;

      while (true) {
        const pageQuery = queryString.stringify({
          page,
          pageSize: PAGE_SIZE_ALL,
          ...(searchTerm ? { searchTerm } : {}),
        });
        const pageEndpoint = `${endpointBase}?${pageQuery}`;
        const pageResponse = await fetch(pageEndpoint, { headers }).then(
          (res) => res.json(),
        );
        if (!firstResponse) {
          firstResponse = pageResponse;
        }

        const pagePersons = Array.isArray(pageResponse?.persons?.data)
          ? pageResponse.persons.data
          : [];
        const pageSpaces = Array.isArray(pageResponse?.spaces?.data)
          ? pageResponse.spaces.data
          : [];

        mergedPersons = mergedPersons.concat(pagePersons);
        mergedSpaces = mergedSpaces.concat(pageSpaces);

        const personsTotal =
          typeof pageResponse?.persons?.pagination?.total === 'number'
            ? pageResponse.persons.pagination.total
            : undefined;
        const spacesTotal =
          typeof pageResponse?.spaces?.pagination?.total === 'number'
            ? pageResponse.spaces.pagination.total
            : undefined;

        const isLastPersonsPage =
          pagePersons.length < PAGE_SIZE_ALL ||
          (personsTotal !== undefined && mergedPersons.length >= personsTotal);
        const isLastSpacesPage =
          pageSpaces.length < PAGE_SIZE_ALL ||
          (spacesTotal !== undefined && mergedSpaces.length >= spacesTotal);

        if (isLastPersonsPage && isLastSpacesPage) {
          break;
        }

        page += 1;
      }

      const uniqueByIdentity = (items: unknown[]) => {
        const seen = new Set<string>();
        return items.filter((item) => {
          const candidate = item as { id?: unknown; slug?: unknown };
          const key = `${String(candidate.id ?? '')}::${String(
            candidate.slug ?? '',
          )}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      const uniquePersons = uniqueByIdentity(mergedPersons);
      const uniqueSpaces = uniqueByIdentity(mergedSpaces);

      const base = (firstResponse ?? {}) as Record<string, unknown>;
      const persons = (base.persons ?? {}) as Record<string, unknown>;
      const spaces = (base.spaces ?? {}) as Record<string, unknown>;
      const personsPagination = (persons.pagination ?? {}) as Record<
        string,
        unknown
      >;
      const spacesPagination = (spaces.pagination ?? {}) as Record<
        string,
        unknown
      >;

      return {
        ...base,
        persons: {
          ...persons,
          data: uniquePersons,
          pagination: {
            ...personsPagination,
            page: 1,
            total: uniquePersons.length,
          },
        },
        spaces: {
          ...spaces,
          data: uniqueSpaces,
          pagination: {
            ...spacesPagination,
            page: 1,
            total: uniqueSpaces.length,
          },
        },
      };
    },
    {
      refreshInterval: interval,
      keepPreviousData,
    },
  );

  const updateMembers = React.useCallback(async () => {
    if (!spaceSlug) {
      await mutate();
      return;
    }

    await mutateCache(
      (key: Key) => {
        if (!Array.isArray(key)) return false;
        const [url] = key;
        return typeof url === 'string' && url.startsWith(endpointBase);
      },
      undefined,
      { revalidate: true },
    );
  }, [mutate, endpointBase, spaceSlug]);

  return {
    persons: response?.persons || { data: [], pagination: undefined },
    spaces: response?.spaces || { data: [], pagination: undefined },
    isLoading,
    updateMembers,
  };
};
