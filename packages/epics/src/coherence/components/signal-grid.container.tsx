import { Coherence, Order } from '@hypha-platform/core/client';
import { SignalGrid } from './signal-grid';
import { Locale } from '@hypha-platform/i18n';

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
  refresh: () => Promise<void>;
  onSignalClick?: (signal: Coherence) => void;
  spaceSlug: string;
  lang: Locale;
  myVotes?: Record<number, -1 | 1>;
  onVoteChange?: (coherenceId: number, next: -1 | 0 | 1) => void;
  onVotesSynced?: () => void | Promise<void>;
  votingCoherenceId?: number | null;
};

export const SignalGridContainer = ({
  basePath,
  pagination,
  signals,
  refresh,
  onSignalClick,
  spaceSlug,
  lang,
  myVotes,
  onVoteChange,
  onVotesSynced,
  votingCoherenceId,
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
      isLoading={false}
      basePath={basePath}
      signals={paginatedSignals.map((signal) => ({
        ...signal,
      }))}
      refresh={refresh}
      onSignalClick={onSignalClick}
      spaceSlug={spaceSlug}
      lang={lang}
      myVotes={myVotes}
      onVoteChange={onVoteChange}
      onVotesSynced={onVotesSynced}
      votingCoherenceId={votingCoherenceId}
    />
  );
};
