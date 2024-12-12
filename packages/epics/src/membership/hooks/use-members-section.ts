import React from 'react';
import { useMembers } from './use-members';

export const useMembersSection = () => {
  const [activeFilter, setActiveFilter] = React.useState('all');
  const [pages, setPages] = React.useState(1);

  const { isLoading, pagination } = useMembers({
    ...(activeFilter !== 'all' && { filter: { status: activeFilter } }),
  });

  React.useEffect(() => {
    setPages(1);
  }, [activeFilter]);

  const loadMore = React.useCallback(() => {
    if (!pagination?.hasNextPage) return;
    setPages(pages + 1);
  }, [pages, pagination?.hasNextPage, setPages]);

  const filterOptions = [
    { label: 'All', value: 'all' },
    { label: 'Most recent', value: 'most-recent' },
  ];

  const tabs = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
    { label: 'Applicants', value: 'applicant' },
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
