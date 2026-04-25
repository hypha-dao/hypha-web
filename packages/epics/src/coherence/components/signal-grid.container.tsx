import { Coherence, Order } from '@hypha-platform/core/client';
import { SignalGrid } from './signal-grid';

type SignalGridContainerProps = {
  basePath: string;
  pagination: {
    page: number;
    firstPageSize: number;
    pageSize: number;
    searchTerm?: string;
    order?: Order<Coherence>;
  };
  signals: Coherence[];
  isLoading?: boolean;
  refresh: () => Promise<void>;
  onSignalClick?: (signal: Coherence) => void;
};

export const SignalGridContainer = ({
  basePath,
  pagination,
  signals,
  isLoading = false,
  refresh,
  onSignalClick,
}: SignalGridContainerProps) => {
  const { page, firstPageSize, pageSize } = pagination;
  const startIndex = page <= 1 ? 0 : firstPageSize + (page - 2) * pageSize;
  const endIndex = Math.min(
    signals.length,
    page < 1 ? 0 : page === 1 ? firstPageSize : startIndex + pageSize,
  );
  const paginatedSignals = signals.slice(startIndex, endIndex);

  return (
    <SignalGrid
      isLoading={isLoading}
      basePath={basePath}
      signals={paginatedSignals.map((signal) => ({
        ...signal,
      }))}
      refresh={refresh}
      onSignalClick={onSignalClick}
    />
  );
};
