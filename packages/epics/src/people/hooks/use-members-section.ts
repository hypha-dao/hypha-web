import React, { useState } from 'react';
import { FILTER_OPTIONS_MEMBERS } from '../../common/constants';
import { FilterParams, Person } from '@hypha-platform/core/client';
import { UseMembers } from '../../spaces';
import { useDebouncedCallback } from 'use-debounce';

const filterOptions = FILTER_OPTIONS_MEMBERS;

type UseMembersSectionProps = {
  useMembers: UseMembers;
  spaceSlug?: string;
  refreshInterval?: number;
};

export const useMembersSection = ({
  useMembers,
  spaceSlug,
  refreshInterval,
}: UseMembersSectionProps) => {
  const [activeFilter, setActiveFilter] = useState<FilterParams<Person>>();
  const [pages, setPages] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState<string | undefined>(
    undefined,
  );

  const onUpdateSearch = useDebouncedCallback((term: string) => {
    setSearchTerm(term);
  }, 300);

  const { isLoading, persons, spaces } = useMembers({
    ...(activeFilter !== undefined && { filter: activeFilter }),
    spaceSlug: spaceSlug,
    searchTerm,
    refreshInterval,
  });

  const pagination = React.useMemo(() => {
    const totalPersons = persons?.pagination?.total || 0;
    const totalSpaces = spaces?.pagination?.total || 0;

    return {
      ...(persons?.pagination || {}),
      total: totalPersons + totalSpaces,
    };
  }, [persons?.pagination, spaces?.pagination]);

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
