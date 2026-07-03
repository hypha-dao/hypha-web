import Link from 'next/link';
import { cn } from '@hypha-platform/ui-utils';
import { SignalCard } from './signal-card';
import { Coherence } from '@hypha-platform/core/client';
import { SIGNAL_SLUG_SELECTOR_ATTR } from '../lib/signal-deep-link-dom';

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
    <div className="grid w-full grid-cols-1 items-start gap-2 md:grid-cols-[repeat(auto-fill,minmax(min(100%,14.25rem),1fr))]">
      {signals.map((signal) =>
        signal.archived ? (
          <SignalCard
            key={signal.id}
            {...signal}
            leadImage={leadImage}
            className="w-full min-h-0"
            isLoading={isLoading}
            refresh={refresh}
          />
        ) : onSignalClick ? (
          <div
            key={signal.id}
            {...(signal.slug
              ? { [SIGNAL_SLUG_SELECTOR_ATTR]: signal.slug }
              : {})}
            role="button"
            tabIndex={0}
            className={cn(
              'flex min-h-0 w-full cursor-pointer rounded-xl text-left outline-none',
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
              className="w-full min-h-0"
              isLoading={isLoading}
              refresh={refresh}
            />
          </div>
        ) : (
          <Link
            key={signal.id}
            href={`${basePath}/${signal.slug}`}
            className="flex min-h-0 w-full"
          >
            <SignalCard
              {...signal}
              leadImage={leadImage}
              className="w-full min-h-0"
              isLoading={isLoading}
              refresh={refresh}
            />
          </Link>
        ),
      )}
    </div>
  );
}
