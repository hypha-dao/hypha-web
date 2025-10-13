import React from 'react';
import { useDebouncedCallback } from 'use-debounce';

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

export const useDocumentsSection = ({
  documents,
  firstPageSize = 3,
  pageSize = 3,
}: {
  documents: any[];
  firstPageSize?: number;
  pageSize?: number;
}) => {
  if (firstPageSize <= 0 || pageSize <= 0) {
    throw new Error('firstPageSize and pageSize must be positive numbers');
  }
  const [activeFilter, setActiveFilter] = React.useState('most-recent');
  const [pages, setPages] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState<string | undefined>(
    undefined,
  );

  const onUpdateSearch = useDebouncedCallback((term: string) => {
    setSearchTerm(term);
  }, 300);

  const filteredDocuments = React.useMemo(() => {
    let result = documents;

    if (searchTerm) {
      result = result.filter(
        (doc) =>
          doc.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.description?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    return result;
  }, [documents, searchTerm]);

  const pagination = React.useMemo(() => {
    const total = filteredDocuments.length;
    const totalPages =
      total === 0
        ? 0
        : total <= firstPageSize
        ? 1
        : 1 + Math.ceil((total - firstPageSize) / pageSize);
    const hasNextPage = pages < totalPages;

    return {
      page: pages,
      pageSize,
      total,
      totalPages,
      hasNextPage,
    };
  }, [filteredDocuments, pages, firstPageSize, pageSize]);

  React.useEffect(() => {
    setPages(1);
  }, [activeFilter, searchTerm]);

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
    onUpdateSearch,
    searchTerm,
    filteredDocuments,
  };
};
