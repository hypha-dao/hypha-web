import React from 'react';
import useSWR from 'swr';
import {
  AgreementItem,
  PaginationMetadata,
  fetchAgreements,
} from '@hypha-platform/graphql/rsc';
import {
  FILTER_OPTIONS_AGREEMENTS,
  SORT_OPTIONS,
} from '../../common/constants';
type UseAgreementsReturn = {
  agreements: AgreementItem[];
  pagination?: PaginationMetadata;
  isLoading: boolean;
  activeFilter: string;
  setActiveFilter: React.Dispatch<React.SetStateAction<string>>;
  pages: number;
  loadMore: () => void;
  sortOptions: typeof SORT_OPTIONS;
  filterOptions: typeof FILTER_OPTIONS_AGREEMENTS;
};
export const useAgreements = ({
  page = 1,
  filter: initialFilter = 'all',
}: {
  page?: number;
  filter?: string;
}): UseAgreementsReturn => {
  const [activeFilter, setActiveFilter] = React.useState(initialFilter);
  const [pages, setPages] = React.useState(page);
  const [allAgreements, setAllAgreements] = React.useState<AgreementItem[]>([]);
  const filter = activeFilter === 'all' ? undefined : { status: activeFilter };

  const { data, isLoading } = useSWR(
    () => (activeFilter !== null ? ['agreements', pages, filter] : null),
    () =>
      fetchAgreements({
        page: pages,
        filter,
      }),
    { revalidateOnFocus: false }
  );

  React.useEffect(() => {
    if (data && data.agreements) {
      setAllAgreements((prev) => [...prev, ...data.agreements]);
    }
  }, [data]);

  const loadMore = React.useCallback(() => {
    if (!data?.pagination?.hasNextPage) return;
    setPages(pages + 1);
  }, [pages, data?.pagination?.hasNextPage]);

  React.useEffect(() => {
    setPages(1);
    setAllAgreements(data?.agreements || []);
  }, [activeFilter]);

  return {
    agreements: allAgreements,
    pagination: data?.pagination,
    isLoading,
    activeFilter,
    setActiveFilter,
    pages,
    loadMore,
    sortOptions: SORT_OPTIONS,
    filterOptions: FILTER_OPTIONS_AGREEMENTS,
  };
};
