'use client';

import React from 'react';
import useSWR from 'swr';
import queryString from 'query-string';

import { type UseMembers, type UseMembersReturn } from '@hypha-platform/epics';

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
  const queryParams = React.useMemo(() => {
    const effectiveFilter = paginationDisabled
      ? { ...(searchTerm ? { searchTerm } : {}) }
      : { page, pageSize, ...(searchTerm ? { searchTerm } : {}) };
    return `?${queryString.stringify(effectiveFilter)}`;
  }, [page, pageSize, searchTerm, paginationDisabled]);

  console.debug('useMembers', { queryParams });

  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/members${queryParams}`,
    [spaceSlug, queryParams],
  );

  const interval = refreshInterval ?? 0;
  const keepPreviousData = !!interval;

  const { data: response, isLoading } = useSWR(
    spaceSlug ? [endpoint] : null,
    ([endpoint]) =>
      fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json()),
    {
      refreshInterval: interval,
      keepPreviousData,
    },
  );

  return {
    persons: response?.persons || { data: [], pagination: undefined },
    spaces: response?.spaces || { data: [], pagination: undefined },
    isLoading,
  };
};
