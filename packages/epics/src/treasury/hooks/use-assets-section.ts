import React from 'react';
import { useAssets } from './use-assets';
import { FILTER_OPTIONS_ASSETS } from '../../common/constants';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';

export interface UseAssetsSectionProps {
  pageSize?: number;
  filterOptions?: {
    label: string;
    value: string;
  }[];
}

export const useAssetsSection = ({
  pageSize = 9,
  filterOptions = FILTER_OPTIONS_ASSETS,
}: UseAssetsSectionProps = {}) => {
  const [activeFilter, setActiveFilter] = React.useState('all');
  const [visibleCount, setVisibleCount] = React.useState(pageSize);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [hideSmallBalances, setHideSmallBalances] = React.useState(false);

  const { isLoading, balance, assets } = useAssets({
    ...(activeFilter !== 'all' && { filter: { type: activeFilter } }),
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
    // Hide zero-balance noise, but always keep tokens issued by this space
    // (newly created tokens often sit at 0 in the issuer treasury).
    let result = assets.filter(
      (asset) => asset.value > 0 || asset.issuedBySpace,
    );

    if (hideSmallBalances) {
      result = result.filter(
        (asset) => asset.value >= 1 || asset.issuedBySpace,
      );
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
  const positiveAssetCount = assets.filter((asset) => asset.value > 0).length;

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
    positiveAssetCount,
  };
};
