'use client';

import useSWR from 'swr';
import {
  ProposalItem,
  PaginationMetadata,
  FilterParams,
  fetchProposals,
} from '@hypha-platform/graphql/rsc';

type UseProposalsReturn = {
  proposals: ProposalItem[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
};

export const useProposals = ({
  page = 1,
  filter,
}: {
  page?: number;
  filter?: FilterParams;
}): UseProposalsReturn => {
  const { data, isLoading } = useSWR(['proposals', page, filter], () =>
    fetchProposals({ page, filter })
  );

  return {
    proposals: data?.proposals || [],
    pagination: data?.pagination,
    isLoading,
  };
};
