'use client';

import { getAssetBySlug } from '@hypha-platform/graphql/rsc';
import useSWR from 'swr';

export const useAssetBySlug = (slug: string) => {
  const { data, isLoading } = useSWR(['asset-by-slug', slug], ([_, slug]) =>
    getAssetBySlug(slug)
  );
  return { data, isLoading };
};
