import { getMemberBySlug } from '@hypha-platform/graphql/rsc';
import useSWR from 'swr';

export const useMemberBySlug = (slug: string) => {
  const { data, isLoading } = useSWR(['member-by-slug', slug], ([_, slug]) =>
    getMemberBySlug(slug)
  );
  return { data, isLoading };
};
