'use client';

import { useState, useEffect, useCallback } from 'react';
import { FilterParams, Person } from '@hypha-platform/core';
import { type UseMembers } from './types';

type UseSubspaceDetailsProps = {
  useMembers: UseMembers;
};

export const useSubspaceDetails = ({ useMembers }: UseSubspaceDetailsProps) => {
  const [activeFilter, setActiveFilter] = useState<FilterParams<Person>>();
  const [page, setPage] = useState(1);

  const { isLoading, pagination } = useMembers({
    ...(activeFilter !== undefined && { filter: activeFilter }),
  });

  const loadMore = useCallback(() => {
    if (!pagination?.hasNextPage) return;
    setPage(page + 1);
  }, [page, pagination?.hasNextPage, setPage]);

  useEffect(() => {
    setPage(1);
  }, [activeFilter]);

  return {
    isLoading,
    loadMore,
    pagination,
    pages: page,
    setPages: setPage,
    activeFilter,
    setActiveFilter,
  };
};
