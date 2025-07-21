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

import { FilterParams, useJwt } from '@hypha-platform/core/client';

export const useMembers: UseMembers = ({
  page = 1,
  pageSize = 4,
  spaceSlug,
  searchTerm,
  refreshInterval,
}: {
  page?: number;
  pageSize?: number;
  filter?: FilterParams<MemberItem>;
  spaceSlug?: string;
  searchTerm?: string;
  refreshInterval?: number;
}): UseMembersReturn => {
  const { jwt } = useJwt();

  const queryParams = React.useMemo(() => {
    const effectiveFilter = {
      page,
      pageSize,
      ...(searchTerm ? { searchTerm } : {}),
    };
    return `?${queryString.stringify(effectiveFilter)}`;
  }, [page, pageSize, searchTerm]);

  console.debug('useMembers', { queryParams });

  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/members${queryParams}`,
    [spaceSlug, queryParams],
  );

  const interval = refreshInterval ?? 0;
  const keepPreviousData = !!interval;

  const { data: response, isLoading } = useSWR(
    jwt ? [endpoint] : null,
    ([endpoint]) =>
      fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json()),
    {
      refreshInterval: interval,
      keepPreviousData,
    },
  );

  return {
    members: response?.data || [],
    pagination: response?.pagination,
    isLoading,
  };
};
