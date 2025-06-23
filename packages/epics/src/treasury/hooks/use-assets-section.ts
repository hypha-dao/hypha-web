import React from 'react';
import { useAssets } from './use-assets';
import { FILTER_OPTIONS_ASSETS } from '../../common/constants';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';

const filterOptions = FILTER_OPTIONS_ASSETS;

export const useAssetsSection = () => {
  const [activeFilter, setActiveFilter] = React.useState('all');
  const [pages, setPages] = React.useState(1);

  const { isLoading, pagination, balance } = useAssets({
    ...(activeFilter !== 'all' && { filter: { status: activeFilter } }),
  });

  React.useEffect(() => {
    setPages(1);
  }, [activeFilter]);

  const loadMore = React.useCallback(() => {
    if (!pagination?.hasNextPage) return;
    setPages(pages + 1);
  }, [pages, pagination?.hasNextPage, setPages]);

  const totalBalance = `$ ${formatCurrencyValue(balance)}`;

  return {
    isLoading,
    loadMore,
    pagination,
    pages,
    setPages,
    activeFilter,
    setActiveFilter,
    filterOptions,
    totalBalance,
  };
};
