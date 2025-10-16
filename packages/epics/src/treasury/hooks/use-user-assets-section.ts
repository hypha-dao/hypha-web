'use client';

import React from 'react';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { FILTER_OPTIONS_ASSETS } from '../../common/constants';
import { useUserAssets } from './use-user-assets';

export interface UseUserAssetsSectionProps {
  personSlug?: string;
  pageSize?: number;
  filterOptions?: {
    label: string;
    value: string;
  }[];
}

export const useUserAssetsSection = ({
  personSlug,
  pageSize = 9,
  filterOptions = FILTER_OPTIONS_ASSETS,
}: UseUserAssetsSectionProps = {}) => {
  const [activeFilter, setActiveFilter] = React.useState('all');
  const [visibleCount, setVisibleCount] = React.useState(pageSize);

  const { isLoading, balance, assets } = useUserAssets({
    ...(activeFilter !== 'all' && { filter: { type: activeFilter } }),
    personSlug,
  });

  React.useEffect(() => {
    setVisibleCount(pageSize);
  }, [activeFilter, assets.length, pageSize]);

  const loadMore = React.useCallback(() => {
    setVisibleCount((prev) => prev + pageSize);
  }, [pageSize]);

  const totalBalance = `${balance < 0 ? '-' : ''}$ ${formatCurrencyValue(
    Math.abs(balance),
  )}`;
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
