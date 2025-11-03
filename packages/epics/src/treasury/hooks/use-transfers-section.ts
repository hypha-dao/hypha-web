'use client';

import React from 'react';
import { useTransfers } from './use-transfers';

const PAGE_SIZE = 4;

export const useTransfersSection = ({ spaceSlug }: { spaceSlug: string }) => {
  const [activeSort, setSort] = React.useState('all');
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [searchTerm, setSearchTerm] = React.useState('');

  const { isLoading, transfers } = useTransfers({
    ...(activeSort !== 'all' && { sort: { sort: activeSort } }),
    spaceSlug,
  });

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeSort, transfers]);

  const loadMore = React.useCallback(() => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  }, []);

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
  };
};
