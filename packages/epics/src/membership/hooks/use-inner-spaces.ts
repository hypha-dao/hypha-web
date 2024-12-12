import useSWR from 'swr';
import {
  InnerSpaceType,
  PaginationMetadata,
  SortParams,
  fetchInnerSpaces,
} from '@hypha-platform/graphql/rsc';

type UseInnerSpacesReturn = {
  innerSpaces: InnerSpaceType[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
};

export const useInnerSpaces = ({
  page = 1,
  sort,
}: {
  page?: number;
  sort?: SortParams;
}): UseInnerSpacesReturn => {
  const { data, isLoading } = useSWR(['innerSpaces', page, sort], () =>
    fetchInnerSpaces({ page, sort })
  );

  return {
    innerSpaces: data?.innerSpaces || [],
    pagination: data?.pagination,
    isLoading,
  };
};
