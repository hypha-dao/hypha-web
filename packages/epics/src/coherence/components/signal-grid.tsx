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
    // Board-style density: keep card width steady and let column count adapt
    // to available container width (including side panels opening/closing).
    <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(min(100%,15.75rem),1fr))] items-start justify-items-start gap-2.5">
      {signals.map((signal) =>
        signal.archived ? (
          <SignalCard
            key={signal.id}
            {...signal}
            leadImage={leadImage}
            className="w-full min-h-0 max-w-[18rem]"
            isLoading={isLoading}
            refresh={refresh}
          />
        ) : onSignalClick ? (
          <div
            key={signal.id}
            role="button"
            tabIndex={0}
            className={cn(
              'flex min-h-0 w-full max-w-[18rem] cursor-pointer rounded-xl text-left outline-none',
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
              className="w-full min-h-0 max-w-[18rem]"
              isLoading={isLoading}
              refresh={refresh}
              onOpenConversation={() => onSignalClick(signal)}
            />
          </div>
        ) : (
          <Link
            key={signal.id}
            href={`${basePath}/${signal.slug}`}
            className="flex min-h-0 w-full max-w-[18rem]"
          >
            <SignalCard
              {...signal}
              leadImage={leadImage}
              className="w-full min-h-0 max-w-[18rem]"
              isLoading={isLoading}
              refresh={refresh}
            />
          </Link>
        ),
      )}
    </div>
  );
}
