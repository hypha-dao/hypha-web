import React from 'react';
import { useRequests } from './use-requests';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';

export const useRequestsSection = () => {
  const [activeSort, setSort] = React.useState('all');
  const [pages, setPages] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState<number>(0);

  const { isLoading, pagination, totalValue } = useRequests({
    page: pages,
    sort: { sort: activeSort },
  });

  React.useEffect(() => {
    setPages(1);
  }, [activeSort]);

  React.useEffect(() => {
    if (pagination?.total !== undefined) {
      setTotalCount(pagination.total);
    }
  }, [pagination?.total]);

  const loadMore = React.useCallback(() => {
    if (!pagination?.hasNextPage) return;
    setPages(pages + 1);
  }, [pages, pagination?.hasNextPage, setPages]);

  const totalRequestsValue = `$ ${formatCurrencyValue(totalValue)}`;

  return {
    isLoading,
    loadMore,
    pagination,
    pages,
    setPages,
    activeSort,
    setSort,
    totalCount,
    totalRequestsValue,
  };
};
