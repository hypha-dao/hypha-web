import Link from 'next/link';
import { cn } from '@hypha-platform/ui-utils';
import { SignalCard } from './signal-card';
import { Coherence } from '@hypha-platform/core/client';
import { getSignalSlugDomProps } from '../lib/signal-deep-link-dom';
import {
  isSignalSlugActive,
  signalCardActiveClass,
} from '../utils/signal-active-styles';

type SignalGridProps = {
  isLoading: boolean;
  basePath: string;
  leadImage?: string;
  signals: Coherence[];
  refresh: () => Promise<void>;
  onSignalClick?: (signal: Coherence) => void;
  activeSignalSlug?: string | null;
};

export function SignalGrid({
  isLoading,
  basePath,
  leadImage,
  signals,
  refresh,
  onSignalClick,
  activeSignalSlug,
}: SignalGridProps) {
  return (
    <div className="grid w-full grid-cols-1 items-start gap-2 md:grid-cols-[repeat(auto-fill,minmax(min(100%,14.25rem),1fr))]">
      {signals.map((signal) => {
        const isActive = isSignalSlugActive(signal.slug, activeSignalSlug);

        return signal.archived ? (
          <SignalCard
            key={signal.id}
            {...signal}
            leadImage={leadImage}
            className="w-full min-h-0"
            isActive={isActive}
            isLoading={isLoading}
            refresh={refresh}
          />
        ) : onSignalClick ? (
          <div
            key={signal.id}
            {...getSignalSlugDomProps(signal.slug)}
            role="button"
            tabIndex={0}
            className={cn(
              'flex min-h-0 w-full cursor-pointer rounded-xl text-left outline-none transition-[border-color,box-shadow] duration-200',
              signalCardActiveClass(isActive),
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
            {...getSignalSlugDomProps(signal.slug)}
            className={cn(
              'flex min-h-0 w-full rounded-xl transition-[border-color,box-shadow] duration-200',
              signalCardActiveClass(isActive),
            )}
          >
            <SignalCard
              {...signal}
              leadImage={leadImage}
              className="w-full min-h-0"
              isLoading={isLoading}
              refresh={refresh}
            />
          </Link>
        );
      })}
    </div>
  );
}
