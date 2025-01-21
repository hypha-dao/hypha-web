'use client';

import { getAgreementBySlug } from '@hypha-platform/graphql/rsc';
import useSWR from 'swr';

export const useAgreementBySlug = (slug: string) => {
  const { data, isLoading } = useSWR(['agreement-by-slug', slug], ([_, slug]) =>
    getAgreementBySlug(slug)
  );
  return { data, isLoading };
};
