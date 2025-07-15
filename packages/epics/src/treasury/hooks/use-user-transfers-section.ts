'use client';
import React from 'react';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useUserTransfers } from './use-user-transfers';

const PAGE_SIZE = 4;

export const useUserTransfersSection = ({
  personSlug,
}: {
  personSlug: string;
}) => {
  const [activeSort, setSort] = React.useState('all');
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

  const { isLoading, transfers } = useUserTransfers({
    ...(activeSort !== 'all' && { sort: { sort: activeSort } }),
    personSlug,
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
