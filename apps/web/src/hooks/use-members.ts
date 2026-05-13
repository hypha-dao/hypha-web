'use client';

import React from 'react';
import useSWR, { mutate as mutateCache, type Key } from 'swr';
import queryString from 'query-string';

import { type UseMembers, type UseMembersReturn } from '@hypha-platform/epics';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  FilterParams,
  PaginationMetadata,
  Person,
  Space,
} from '@hypha-platform/core/client';

type MembersCollection<T> = {
  data?: T[];
  pagination?: PaginationMetadata;
};

type MembersResponse = {
  persons?: MembersCollection<Person>;
  spaces?: MembersCollection<Space>;
};

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
  filter?: FilterParams<Person>;
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

      const fetchJson = async (url: string): Promise<MembersResponse> => {
        const res = await fetch(url, { headers });
        if (!res.ok) {
          const errorText = (await res.text().catch(() => '')).trim();
          throw new Error(
            `Failed to fetch members (${res.status})${
              errorText ? `: ${errorText}` : ''
            }`,
          );
        }
        return (await res.json()) as MembersResponse;
      };

      if (!paginationDisabled) {
        return fetchJson(endpoint);
      }

      const pageSize = 100;
      let page = 1;
      const allPersons: Person[] = [];
      const allSpaces: Space[] = [];
      let personsPagination: PaginationMetadata | undefined;
      let spacesPagination: PaginationMetadata | undefined;
      const MAX_PAGES = 200;

      while (true) {
        if (page > MAX_PAGES) {
          throw new Error('Members pagination exceeded safety limit');
        }
        const pagedEndpoint = `/api/v1/spaces/${spaceSlug}/members?${queryString.stringify(
          {
            page,
            pageSize,
            ...(searchTerm ? { searchTerm } : {}),
          },
        )}`;
        const pageResponse = await fetchJson(pagedEndpoint);

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
    persons: {
      data: response?.persons?.data ?? [],
      pagination: response?.persons?.pagination,
    },
    spaces: {
      data: response?.spaces?.data ?? [],
      pagination: response?.spaces?.pagination,
    },
    isLoading,
    updateMembers,
  };
};
