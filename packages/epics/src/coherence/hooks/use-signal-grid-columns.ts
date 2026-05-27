'use client';

import React from 'react';
import {
  SIGNAL_GRID_ROW_BATCH_COUNT,
  computeSignalGridRowBatchSize,
} from '../signal-grid-layout';

const DEFAULT_ROW_BATCH_SIZE = SIGNAL_GRID_ROW_BATCH_COUNT;

export function useSignalGridColumns(
  containerRef: React.RefObject<HTMLElement | null>,
) {
  const [rowBatchSize, setRowBatchSize] = React.useState(
    DEFAULT_ROW_BATCH_SIZE,
  );

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const update = () => {
      const containerWidth = element.getBoundingClientRect().width;
      const viewportWidth = window.innerWidth;
      setRowBatchSize(
        computeSignalGridRowBatchSize(containerWidth, viewportWidth),
      );
    };

    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);
    window.addEventListener('resize', update, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [containerRef]);

  return {
    rowBatchSize,
    columns: rowBatchSize / SIGNAL_GRID_ROW_BATCH_COUNT,
  };
}
