'use client';

import useSWR from 'swr';
import {
  OuterSpaceType,
  PaginationMetadata,
  SortParams,
  fetchOuterSpaces,
} from '@hypha-platform/graphql/rsc';

type UseOuterSpacesReturn = {
  outerSpaces: OuterSpaceType[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
};

export const useOuterSpaces = ({
  page = 1,
  sort,
}: {
  page?: number;
  sort?: SortParams;
}): UseOuterSpacesReturn => {
  const { data, isLoading } = useSWR(['outerSpaces', page, sort], () =>
    fetchOuterSpaces({ page, sort })
  );

  return {
    outerSpaces: data?.outerSpaces || [],
    pagination: data?.pagination,
    isLoading,
  };
};
