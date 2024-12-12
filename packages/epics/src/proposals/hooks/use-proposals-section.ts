import React from 'react';
import { useProposals } from './use-proposals';

const filterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Most recent', value: 'most-recent' },
];

export const useProposalsSection = () => {
  const [activeFilter, setActiveFilter] = React.useState('all');
  const [pages, setPages] = React.useState(1);

  const { isLoading, pagination } = useProposals({
    ...(activeFilter !== 'all' && { filter: { status: activeFilter } }),
  });

  React.useEffect(() => {
    setPages(1);
  }, [activeFilter]);

  const loadMore = React.useCallback(() => {
    if (!pagination?.hasNextPage) return;
    setPages(pages + 1);
  }, [pages, pagination?.hasNextPage, setPages]);

  const tabs = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'On voting', value: 'voting' },
    { label: 'Completed', value: 'completed' },
    { label: 'Rejected', value: 'rejected' },
  ];

  return {
    isLoading,
    loadMore,
    pagination,
    pages,
    setPages,
    activeFilter,
    setActiveFilter,
    filterOptions,
    tabs,
  };
};
