import Link from 'next/link';
import { cn } from '@hypha-platform/ui-utils';
import { SignalCard } from './signal-card';
import { Coherence } from '@hypha-platform/core/client';

type SignalGridProps = {
  isLoading: boolean;
  basePath: string;
  leadImage?: string;
  signals: Coherence[];
  refresh: () => Promise<void>;
  onSignalClick?: (signal: Coherence) => void;
};

export function SignalGrid({
  isLoading,
  basePath,
  leadImage,
  signals,
  refresh,
  onSignalClick,
}: SignalGridProps) {
  return (
    <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),24rem))] justify-start gap-3 md:gap-4 lg:gap-4">
      {signals.map((signal) =>
        signal.archived ? (
          <SignalCard
            key={signal.id}
            {...signal}
            leadImage={leadImage}
            className="h-full w-full min-h-0"
            isLoading={isLoading}
            refresh={refresh}
          />
        ) : onSignalClick ? (
          <div
            key={signal.id}
            role="button"
            tabIndex={0}
            className={cn(
              'flex h-full min-h-0 w-full cursor-pointer rounded-2xl text-left outline-none',
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
              leadImage={leadImage}
              className="h-full w-full min-h-0"
              isLoading={isLoading}
              refresh={refresh}
              onOpenConversation={() => onSignalClick(signal)}
            />
          </div>
        ) : (
          <Link
            key={signal.id}
            href={`${basePath}/${signal.slug}`}
            className="flex h-full min-h-0"
          >
            <SignalCard
              {...signal}
              leadImage={leadImage}
              className="h-full w-full min-h-0"
              isLoading={isLoading}
              refresh={refresh}
            />
          </Link>
        ),
      )}
    </div>
  );
}
