import React from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { DirectionType } from '@core/common';

export const tabs = [
  {
    label: 'All',
    value: 'all',
  },
  {
    label: 'Hypha Space',
    value: 'hypha-space',
  },
  {
    label: 'EOS Space',
    value: 'eos-space',
  },
  {
    label: 'Hypha Energy',
    value: 'hypha-energy',
  },
];

export const useDocumentsSection = ({ documents }: { documents: any[] }) => {
  const [activeFilter, setActiveFilter] = React.useState('most-recent');
  const [pages, setPages] = React.useState(1);
  const [activeTab, setActiveTab] = React.useState('all');
  const [searchTerm, setSearchTerm] = React.useState<string | undefined>(
    undefined,
  );

  const onUpdateSearch = useDebouncedCallback((term: string) => {
    setSearchTerm(term);
  }, 300);

  const { isLoading, pagination } = useDocuments({
    page: pages,
    pageSize: 3,
    filter: { state: documentState },
    searchTerm,
    order: [
      {
        dir: DirectionType.Desc,
        name: 'createdAt',
      },
    ]
  });

  React.useEffect(() => {
    setPages(1);
  }, [activeFilter, activeTab, searchTerm]);

  const loadMore = React.useCallback(() => {
    if (!pagination?.hasNextPage) return;
    setPages((prev) => prev + 1);
  }, [pagination?.hasNextPage]);

  return {
    isLoading: false,
    loadMore,
    pagination,
    pages,
    setPages,
    activeFilter,
    setActiveFilter,
    tabs,
    activeTab,
    setActiveTab,
    onUpdateSearch,
    searchTerm,
    filteredDocuments,
  };
};
