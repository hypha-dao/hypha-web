'use client';

import useSWR from 'swr';
import {
  DiscussionItem,
  fetchDiscussions,
  PaginationMetadata,
  PaginationParams,
} from '@hypha-platform/graphql/rsc';

type UseDiscussionsReturn = {
  discussions: DiscussionItem[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
};

export const useDiscussions = ({
  page = 1,
  filter,
}: PaginationParams): UseDiscussionsReturn => {
  const { data, isLoading } = useSWR(['discussions', page, filter], () =>
    fetchDiscussions({ page, filter })
  );

  return {
    discussions: data?.discussions || [],
    pagination: data?.pagination,
    isLoading,
  };
};
