import Link from 'next/link';
import { SignalCard } from './signal-card';
import { Coherence } from '@hypha-platform/core/client';

type SignalGridProps = {
  isLoading: boolean;
  basePath: string;
  signals: Coherence[];
  refresh: () => Promise<void>;
  onSignalClick?: (signal: Coherence) => void;
};

export function SignalGrid({
  isLoading,
  basePath,
  signals,
  refresh,
  onSignalClick,
}: SignalGridProps) {
  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
      {signals.map((signal) =>
        signal.archived ? (
          <SignalCard
            key={signal.id}
            {...signal}
            isLoading={isLoading}
            refresh={refresh}
          />
        ) : onSignalClick ? (
          <button
            key={signal.id}
            type="button"
            className="text-left w-full"
            onClick={() => onSignalClick(signal)}
          >
            <SignalCard
              {...signal}
              isLoading={isLoading}
              refresh={refresh}
              onOpenConversation={() => onSignalClick(signal)}
            />
          </button>
        ) : (
          <Link key={signal.id} href={`${basePath}/${signal.slug}`}>
            <SignalCard {...signal} isLoading={isLoading} refresh={refresh} />
          </Link>
        ),
      )}
    </div>
  );
}
