import Link from 'next/link';
import { cn } from '@hypha-platform/ui-utils';
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
    <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 lg:gap-4">
      {signals.map((signal) =>
        signal.archived ? (
          <SignalCard
            key={signal.id}
            {...signal}
            isLoading={isLoading}
            refresh={refresh}
          />
        ) : onSignalClick ? (
          <div
            key={signal.id}
            role="button"
            tabIndex={0}
            className={cn(
              'w-full cursor-pointer rounded-2xl text-left outline-none',
              'focus-visible:ring-2 focus-visible:ring-accent-9/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
            onClick={() => onSignalClick(signal)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSignalClick(signal);
              }
            }}
          >
            <SignalCard
              {...signal}
              isLoading={isLoading}
              refresh={refresh}
              onOpenConversation={() => onSignalClick(signal)}
            />
          </div>
        ) : (
          <Link key={signal.id} href={`${basePath}/${signal.slug}`}>
            <SignalCard {...signal} isLoading={isLoading} refresh={refresh} />
          </Link>
        ),
      )}
    </div>
  );
}
