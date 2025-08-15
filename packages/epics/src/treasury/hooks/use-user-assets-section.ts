'use client';

import React from 'react';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { FILTER_OPTIONS_ASSETS } from '../../common/constants';
import { useUserAssets } from './use-user-assets';

export const useUserAssetsSection = ({
  personSlug,
}: {
  personSlug?: string;
}) => {
  const [activeFilter, setActiveFilter] = React.useState('all');
  const [visibleCount, setVisibleCount] = React.useState(3);

  const { isLoading, balance, assets } = useUserAssets({
    ...(activeFilter !== 'all' && { filter: { type: activeFilter } }),
    personSlug,
  });

  React.useEffect(() => {
    setVisibleCount(3);
  }, [activeFilter, assets]);

  const loadMore = React.useCallback(() => {
    setVisibleCount((prev) => prev + 3);
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
    filterOptions: FILTER_OPTIONS_ASSETS,
    totalBalance,
  };
};
