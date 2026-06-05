'use client';

import { Coherence } from '@hypha-platform/core/client';
import React from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { alignSignalVisibleCount } from '../signal-grid-layout';

export const useSignalsSection = ({
  signals,
  rowBatchSize,
}: {
  signals: Coherence[];
  rowBatchSize: number;
}) => {
  const [activeFilter, setActiveFilter] = React.useState('most-recent');
  const [visibleCount, setVisibleCount] = React.useState(rowBatchSize);
  const [searchTerm, setSearchTerm] = React.useState<string | undefined>(
    undefined,
  );
  const rowBatchSizeRef = React.useRef(rowBatchSize);
  rowBatchSizeRef.current = rowBatchSize;

  const onUpdateSearch = useDebouncedCallback((term: string) => {
    setSearchTerm(term);
  }, 300);

  const filteredSignals = React.useMemo(() => {
    let result = signals;

    const query = searchTerm?.trim()?.toLowerCase();
    if (query) {
      result = result.filter((sig) =>
        [sig.title, sig.description].some(
          (value) => value?.toLowerCase()?.includes(query) ?? false,
        ),
      );
    }

    return result;
  }, [signals, searchTerm]);

  React.useEffect(() => {
    const batch = rowBatchSizeRef.current > 0 ? rowBatchSizeRef.current : 3;
    setVisibleCount(batch);
  }, [searchTerm, activeFilter, signals]);

  React.useEffect(() => {
    if (rowBatchSize <= 0) return;
    setVisibleCount((prev) => alignSignalVisibleCount(prev, rowBatchSize));
  }, [rowBatchSize]);

  const visibleSignals = React.useMemo(
    () => filteredSignals.slice(0, visibleCount),
    [filteredSignals, visibleCount],
  );

  const hasMore = visibleCount < filteredSignals.length;

  const loadMore = React.useCallback(() => {
    if (!hasMore || rowBatchSize <= 0) return;
    setVisibleCount((prev) =>
      Math.min(prev + rowBatchSize, filteredSignals.length),
    );
  }, [filteredSignals.length, hasMore, rowBatchSize]);

  return {
    isLoading: false,
    loadMore,
    hasMore,
    visibleSignals,
    visibleCount,
    rowBatchSize,
    setVisibleCount,
    activeFilter,
    setActiveFilter,
    onUpdateSearch,
    searchTerm,
    filteredSignals,
  };
};
