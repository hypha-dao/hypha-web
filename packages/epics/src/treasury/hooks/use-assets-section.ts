import React from 'react';
import { useAssets } from './use-assets';
import { FILTER_OPTIONS_ASSETS } from '../../common/constants';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';

const filterOptions = FILTER_OPTIONS_ASSETS;
const PAGE_SIZE = 3;

export const useAssetsSection = () => {
  const [activeFilter, setActiveFilter] = React.useState('all');
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

  const { isLoading, balance, assets } = useAssets({
    ...(activeFilter !== 'all' && { filter: { type: activeFilter } }),
  });

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeFilter, assets]);

  const loadMore = React.useCallback(() => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  }, []);

  const totalBalance = `$ ${formatCurrencyValue(balance)}`;
  const visibleAssets = assets.slice(0, visibleCount);
  const hasMore = visibleCount < assets.length;

  return {
    isLoading,
    loadMore,
    visibleAssets,
    hasMore,
    activeFilter,
    setActiveFilter,
    filterOptions,
    totalBalance,
  };
};
