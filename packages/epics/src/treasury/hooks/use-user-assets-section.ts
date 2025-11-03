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
  const [searchTerm, setSearchTerm] = React.useState('');
  const [hideSmallBalances, setHideSmallBalances] = React.useState(false);

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

  const filteredAssets = React.useMemo(() => {
    let result = assets;

    if (hideSmallBalances) {
      result = result.filter((asset) => asset.value >= 1);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (asset) =>
          asset.name.toLowerCase().includes(term) ||
          asset.symbol.toLowerCase().includes(term) ||
          asset.address.toLowerCase().includes(term),
      );
    }

    return result.slice(0, visibleCount);
  }, [assets, hideSmallBalances, searchTerm, visibleCount]);

  const hasMore = !searchTerm.trim() && filteredAssets.length < assets.length;

  return {
    isLoading,
    loadMore,
    filteredAssets,
    hasMore,
    activeFilter,
    setActiveFilter,
    filterOptions,
    totalBalance,
    searchTerm,
    setSearchTerm,
    hideSmallBalances,
    setHideSmallBalances,
    visibleCount,
  };
};
