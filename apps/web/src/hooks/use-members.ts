'use client';

import React from 'react';
import useSWR from 'swr';

import { MemberItem, FilterParams } from '@hypha-platform/graphql/rsc';
import { type UseMembers, type UseMembersReturn } from '@hypha-platform/epics';

import { useSpaceSlug } from './use-space-slug';
import { useJwt } from '@hypha-platform/core/client';

export const useMembers: UseMembers = ({
  page = 1,
  filter,
}: {
  page?: number;
  filter?: FilterParams<MemberItem>;
}): UseMembersReturn => {
  const { jwt } = useJwt();
  const spaceSlug = useSpaceSlug();

  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/members?page=${page}`,
    [spaceSlug, page],
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
