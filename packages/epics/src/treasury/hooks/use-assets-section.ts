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
