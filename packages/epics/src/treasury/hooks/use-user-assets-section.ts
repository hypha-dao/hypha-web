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

  const { isLoading, balance, assets, manualUpdate } = useUserAssets({
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

  const displayableAssets = React.useMemo(() => {
    let result = assets.filter((asset) => asset.value > 0);

    if (hideSmallBalances) {
      result = result.filter((asset) => asset.value >= 1);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (asset) =>
          asset.name.toLowerCase().includes(term) ||
          asset.symbol.toLowerCase().includes(term) ||
          (asset.address?.toLowerCase().includes(term) ?? false),
      );
    }

    return result;
  }, [assets, hideSmallBalances, searchTerm]);

  const filteredAssets = React.useMemo(
    () => displayableAssets.slice(0, visibleCount),
    [displayableAssets, visibleCount],
  );

  const hasMore =
    !searchTerm.trim() && filteredAssets.length < displayableAssets.length;

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
    updateUserAssets: manualUpdate,
  };
};
