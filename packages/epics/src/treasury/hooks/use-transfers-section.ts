'use client';

import React from 'react';
import { useTransfers } from './use-transfers';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';

const PAGE_SIZE = 4;

export const useTransfersSection = ({ spaceSlug }: { spaceSlug: string }) => {
  const [activeSort, setSort] = React.useState('all');
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

  const { isLoading, transfers } = useTransfers({
    ...(activeSort !== 'all' && { sort: { sort: activeSort } }),
    spaceSlug: spaceSlug,
  });

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeSort, transfers]);

  const loadMore = React.useCallback(() => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  }, []);

  const totalValue = React.useMemo(() => {
    if (!transfers) return 0;
    return transfers.reduce((sum, transfer) => sum + (transfer.value || 0), 0);
  }, [transfers]);

  const totalRequestsValue = `$ ${formatCurrencyValue(totalValue)}`;
  const visibleTransfers = transfers?.slice(0, visibleCount) || [];
  const hasMore = transfers ? visibleCount < transfers.length : false;

  return {
    isLoading,
    loadMore,
    transfers: visibleTransfers,
    hasMore,
    activeSort,
    setSort,
    totalRequestsValue,
  };
};
