import React from 'react';
import {
  FILTER_OPTIONS_DISCUSSIONS,
  SORT_OPTIONS,
} from '../../common/constants';
import { UseDocuments } from '../../governance';

const sortOptions = SORT_OPTIONS;

const filterOptions = FILTER_OPTIONS_DISCUSSIONS;

export const useDiscussionsSection = ({
  useDocuments,
}: {
  useDocuments: UseDocuments;
}) => {
  const [activeFilter, setActiveFilter] = React.useState('all');
  const [pages, setPages] = React.useState(1);

  const { isLoading, pagination } = useDocuments({
    filter: { state: 'discussion' },
  });

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
    pages,
    setPages,
    activeFilter,
    setActiveFilter,
    sortOptions,
    filterOptions,
  };
};
