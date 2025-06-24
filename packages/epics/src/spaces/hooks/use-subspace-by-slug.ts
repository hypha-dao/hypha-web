'use client';

import { getSubspaceBySlug } from '@hypha-platform/graphql/rsc';
import useSWR from 'swr';

export const useSubspaceBySlug = (slug: string) => {
  const { data, isLoading } = useSWR(['subspace-by-slug', slug], ([_, slug]) =>
    getSubspaceBySlug(slug),
  );
  return { data, isLoading };
};
