'use client';

import { getProposalBySlug } from '@hypha-platform/graphql/rsc';
import useSWR from 'swr';

export const useProposalBySlug = (slug: string) => {
  const { data, isLoading } = useSWR(['proposal-by-slug', slug], ([_, slug]) =>
    getProposalBySlug(slug)
  );
  return { data, isLoading };
};
