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
  commitment: number;
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
}: {
  page?: number;
  pageSize?: number;
  filter?: FilterParams<MemberItem>;
  spaceSlug?: string;
  searchTerm?: string;
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
    [spaceSlug, page, pageSize, queryParams],
  );

  const { data: response, isLoading } = useSWR(
    jwt ? [endpoint] : null,
    ([endpoint]) =>
      fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json()),
  );

  return {
    members: response?.data || [],
    pagination: response?.pagination,
    isLoading,
  };
};
