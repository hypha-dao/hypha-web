'use client';
import React from 'react';
import { useUserTransfers } from './use-user-transfers';

const DEFAULT_PAGE_SIZE = 4;

export const useUserTransfersSection = ({
  personSlug,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  personSlug?: string;
  pageSize?: number;
}) => {
  const [activeSort, setSort] = React.useState('all');
  const [visibleCount, setVisibleCount] = React.useState(pageSize);
  const [searchTerm, setSearchTerm] = React.useState('');

  const { isLoading, transfers } = useUserTransfers({
    ...(activeSort !== 'all' && { sort: { sort: activeSort } }),
    personSlug,
  });

  React.useEffect(() => {
    setVisibleCount(pageSize);
  }, [activeSort, transfers, pageSize]);

  const loadMore = React.useCallback(() => {
    setVisibleCount((prev) => prev + pageSize);
  }, [pageSize]);

  const filteredResults = React.useMemo(() => {
    if (!transfers) return [];
    if (!searchTerm.trim()) return transfers;

    const term = searchTerm.toLowerCase();

    return transfers.filter((transfer) => {
      const hash = transfer.transactionHash?.toLowerCase() ?? '';
      const symbol = transfer.symbol?.toLowerCase() ?? '';
      const name = transfer.person?.name?.toLowerCase() ?? '';
      const surname = transfer.person?.surname?.toLowerCase() ?? '';
      const from = transfer.from?.toLowerCase() ?? '';
      const to = transfer.to?.toLowerCase() ?? '';

      return (
        hash.includes(term) ||
        symbol.includes(term) ||
        name.includes(term) ||
        surname.includes(term) ||
        from.includes(term) ||
        to.includes(term)
      );
    });
  }, [transfers, searchTerm]);

  const visibleTransfers = React.useMemo(() => {
    if (searchTerm.trim()) return filteredResults;
    return filteredResults.slice(0, visibleCount);
  }, [filteredResults, visibleCount, searchTerm]);

  const hasMore =
    !searchTerm.trim() && visibleCount < (filteredResults?.length || 0);

  return {
    isLoading,
    loadMore,
    transfers: visibleTransfers,
    hasMore,
    activeSort,
    setSort,
    searchTerm,
    setSearchTerm,
    pageSize,
  };
};
