import React, { useState } from 'react';
import { FILTER_OPTIONS_MEMBERS } from '../../common/constants';
import { FilterParams, Person } from '@hypha-platform/core/client';
import { type UseMembers } from './types';
import { useDebouncedCallback } from 'use-debounce';

const filterOptions = FILTER_OPTIONS_MEMBERS;

type UseMembersSectionProps = {
  useMembers: UseMembers;
  spaceSlug?: string;
};

export const useMembersSection = ({
  useMembers,
  spaceSlug,
}: UseMembersSectionProps) => {
  const [activeFilter, setActiveFilter] = useState<FilterParams<Person>>();
  const [pages, setPages] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState<string | undefined>(
    undefined,
  );

  const onUpdateSearch = useDebouncedCallback((term: string) => {
    setSearchTerm(term);
  }, 300);

  const { isLoading, pagination } = useMembers({
    ...(activeFilter !== undefined && { filter: activeFilter }),
    spaceSlug: spaceSlug,
    searchTerm,
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
    onUpdateSearch,
    searchTerm,
  };
};
