import React from 'react';
import {
  FILTER_OPTIONS_DISCUSSIONS,
  FILTER_OPTIONS_AGREEMENTS,
  FILTER_OPTIONS_PROPOSALS,
  SORT_OPTIONS,
} from '../../common/constants';
import { UseDocuments } from '../../governance';

const sortOptions = SORT_OPTIONS;

export const useDocumentsSection = ({
  useDocuments,
  filterOptionsType,
}: {
  useDocuments: UseDocuments;
  filterOptionsType: string;
}) => {
  const [activeFilter, setActiveFilter] = React.useState('all');
  const [pages, setPages] = React.useState(1);

  const filterState = {
    discussions: 'discussion',
    agreements: 'agreement',
    proposals: 'proposal',
  }[filterOptionsType];

  const { isLoading, pagination, documents } = useDocuments({
    page: pages,
    pageSize: 3,
    filter: { state: filterState },
  });

  const filterOptions = {
    discussions: FILTER_OPTIONS_DISCUSSIONS,
    agreements: FILTER_OPTIONS_AGREEMENTS,
    proposals: FILTER_OPTIONS_PROPOSALS,
  }[filterOptionsType];

  React.useEffect(() => {
    setPages(1);
  }, [activeFilter]);

  const loadMore = React.useCallback(() => {
    if (!pagination?.hasNextPage) return;
    setPages(pages + 1);
  }, [pages, pagination?.hasNextPage, setPages]);

  return {
    isLoading,
    loadMore,
    pagination,
    documents,
    pages,
    setPages,
    activeFilter,
    setActiveFilter,
    sortOptions,
    filterOptions,
  };
};
