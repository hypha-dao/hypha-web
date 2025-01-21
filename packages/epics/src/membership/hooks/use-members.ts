'use client';

import useSWR from 'swr';
import {
  MemberItem,
  PaginationMetadata,
  FilterParams,
  fetchMembers,
} from '@hypha-platform/graphql/rsc';

type UseMembersReturn = {
  members: MemberItem[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
};

export const useMembers = ({
  page = 1,
  filter,
}: {
  page?: number;
  filter?: FilterParams;
}): UseMembersReturn => {
  const { data, isLoading } = useSWR(['members', page, filter], () =>
    fetchMembers({ page, filter })
  );

  return {
    members: data?.members || [],
    pagination: data?.pagination,
    isLoading,
  };
};
