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

  const queryParams = React.useMemo(() => {
    const effectiveFilter = paginationDisabled
      ? { ...(searchTerm ? { searchTerm } : {}) }
      : { page, pageSize, ...(searchTerm ? { searchTerm } : {}) };
    return `?${queryString.stringify(effectiveFilter)}`;
  }, [page, pageSize, searchTerm, paginationDisabled]);

  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/members${queryParams}`,
    [spaceSlug, queryParams],
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

      const pageSize = 100;
      let page = 1;
      const allPersons: any[] = [];
      const allSpaces: any[] = [];
      let personsPagination: any;
      let spacesPagination: any;

      while (true) {
        const pagedEndpoint = `/api/v1/spaces/${spaceSlug}/members?${queryString.stringify(
          {
            page,
            pageSize,
            ...(searchTerm ? { searchTerm } : {}),
          },
        )}`;
        const pageResponse = await fetch(pagedEndpoint, { headers }).then(
          (res) => res.json(),
        );

        const personsData = pageResponse?.persons?.data ?? [];
        const spacesData = pageResponse?.spaces?.data ?? [];
        allPersons.push(...personsData);
        allSpaces.push(...spacesData);
        personsPagination = pageResponse?.persons?.pagination;
        spacesPagination = pageResponse?.spaces?.pagination;

        const personsHasNext = Boolean(
          pageResponse?.persons?.pagination?.hasNextPage,
        );
        const spacesHasNext = Boolean(
          pageResponse?.spaces?.pagination?.hasNextPage,
        );

        if (!personsHasNext && !spacesHasNext) {
          break;
        }

        page += 1;
      }

      return {
        persons: {
          data: allPersons,
          pagination: personsPagination,
        },
        spaces: {
          data: allSpaces,
          pagination: spacesPagination,
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
        return (
          typeof url === 'string' &&
          url.startsWith(`/api/v1/spaces/${spaceSlug}/members`)
        );
      },
      undefined,
      { revalidate: true },
    );
  }, [mutate, spaceSlug]);

  return {
    persons: response?.persons || { data: [], pagination: undefined },
    spaces: response?.spaces || { data: [], pagination: undefined },
    isLoading,
    updateMembers,
  };
};
