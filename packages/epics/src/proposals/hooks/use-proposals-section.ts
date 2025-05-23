import React from 'react';
import { FILTER_OPTIONS_PROPOSALS } from '../../common/constants';
import { UseDocuments } from '../../governance';

const filterOptions = FILTER_OPTIONS_PROPOSALS;

export const useProposalsSection = ({
  useDocuments,
}: {
  useDocuments: UseDocuments;
}) => {
  const [activeFilter, setActiveFilter] = React.useState('all');
  const [pages, setPages] = React.useState(1);

  const { isLoading, pagination } = useDocuments({
    filter: { state: 'proposal' },
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
    filterOptions,
  };
};
