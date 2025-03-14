'use client';

import React from 'react';
import useSWR from 'swr';

import { MemberItem, FilterParams } from '@hypha-platform/graphql/rsc';
import { type UseMembers, type UseMembersReturn } from '@hypha-platform/epics';

import { useSpaceSlug } from './use-space-slug';

export const useMembers: UseMembers = ({
  page = 1,
  filter,
}: {
  page?: number;
  filter?: FilterParams<MemberItem>;
}): UseMembersReturn => {
  const spaceSlug = useSpaceSlug();

  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/members?page=${page}`,
    [spaceSlug, page],
  );

  const { data: response, isLoading } = useSWR([endpoint], ([endpoint]) =>
    fetch(endpoint).then((res) => res.json()),
  );

  return {
    members: response?.data || [],
    pagination: response?.pagination,
    isLoading,
  };
};
