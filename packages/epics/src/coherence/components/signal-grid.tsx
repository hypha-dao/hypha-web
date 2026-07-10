import Link from 'next/link';
import { cn } from '@hypha-platform/ui-utils';
import { SignalCard } from './signal-card';
import { Coherence } from '@hypha-platform/core/client';
import { getSignalSlugDomProps } from '../lib/signal-deep-link-dom';
import {
  isSignalSlugActive,
  signalCardActiveClass,
} from '../utils/signal-active-styles';
import {
  SIGNAL_GRID_CARD_WRAPPER_CLASS,
  SIGNAL_GRID_LAYOUT_CLASS,
} from '../utils/signal-board-layout';

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
    <div className={SIGNAL_GRID_LAYOUT_CLASS}>
      {signals.map((signal) => {
        const isActive = isSignalSlugActive(signal.slug, activeSignalSlug);

        return signal.archived ? (
          <div key={signal.id} className={SIGNAL_GRID_CARD_WRAPPER_CLASS}>
            <SignalCard
              {...signal}
              leadImage={leadImage}
              className="h-full min-h-0 w-full"
              isLoading={isLoading}
              refresh={refresh}
            />
          </div>
        ) : onSignalClick ? (
          <div
            key={signal.id}
            {...getSignalSlugDomProps(signal.slug)}
            role="button"
            tabIndex={0}
            className={cn(
              SIGNAL_GRID_CARD_WRAPPER_CLASS,
              'cursor-pointer rounded-xl text-left outline-none transition-[border-color,box-shadow] duration-200',
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
              className="h-full min-h-0 w-full"
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
              SIGNAL_GRID_CARD_WRAPPER_CLASS,
              'rounded-xl transition-[border-color,box-shadow] duration-200',
              signalCardActiveClass(isActive),
            )}
          >
            <SignalCard
              {...signal}
              leadImage={leadImage}
              className="h-full min-h-0 w-full"
              isLoading={isLoading}
              refresh={refresh}
            />
          </Link>
        );
      })}
    </div>
  );
}
