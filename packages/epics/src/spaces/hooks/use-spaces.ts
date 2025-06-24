'use client';

import useSWR from 'swr';
import {
  SpaceType,
  SortParams,
  fetchSpaces,
} from '@hypha-platform/graphql/rsc';
import { PaginationMetadata } from '@core/common';

type UseSpacesReturn = {
  spaces: SpaceType[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
};

export const useSpaces = ({
  page = 1,
  pageSize = 10,
  sort,
}: {
  page?: number;
  pageSize?: number;
  sort?: SortParams;
}): UseSpacesReturn => {
  const { data, isLoading } = useSWR(
    ['spaces', page, pageSize, sort],
    ([_, page, pageSize, sort]) => fetchSpaces({ page, pageSize, sort }),
  );

  return {
    spaces: data?.spaces || [],
    pagination: data?.pagination,
    isLoading,
  };
};
