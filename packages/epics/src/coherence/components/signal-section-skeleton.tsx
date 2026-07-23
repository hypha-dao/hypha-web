'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import type { SignalViewMode } from './signal-section';

function SkeletonBlock({
  className,
  delayMs = 0,
}: {
  className?: string;
  delayMs?: number;
}) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
      aria-hidden
    />
  );
}

function SkeletonCard({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div
      className="animate-pulse rounded-lg border border-border/60 bg-muted/30 p-3"
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
      aria-hidden
    >
      <div className="h-3 w-3/4 rounded bg-muted" />
      <div className="mt-2 h-3 w-1/2 rounded bg-muted/80" />
      <div className="mt-4 flex items-center gap-2">
        <div className="h-5 w-14 rounded-full bg-muted/80" />
        <div className="h-5 w-9 rounded-full bg-muted/60" />
        <div className="ml-auto h-5 w-5 rounded-full bg-muted/80" />
      </div>
    </div>
  );
}

/**
 * Pulsing placeholder shown while signals and the space workflow load,
 * shaped to roughly match the active view so the reveal doesn't jump.
 */
export function SignalSectionSkeleton({
  viewMode,
}: {
  viewMode: SignalViewMode;
}) {
  const t = useTranslations('CoherenceTab');

  return (
    <div role="status" aria-busy="true" className="w-full">
      <span className="sr-only">{t('loadingSignals')}</span>
      {viewMode === 'board' ? (
        <div className="flex w-full gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((column) => (
            <div
              key={column}
              className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border border-border/50 bg-muted/10 p-2"
            >
              <SkeletonBlock className="h-6 w-24" delayMs={column * 120} />
              {Array.from({ length: 3 - (column % 2) }, (_, card) => (
                <SkeletonCard key={card} delayMs={column * 120 + card * 150} />
              ))}
            </div>
          ))}
        </div>
      ) : viewMode === 'swimlane' ? (
        <div className="flex w-full flex-col gap-3">
          {[0, 1, 2].map((lane) => (
            <div
              key={lane}
              className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/10 p-2"
            >
              <SkeletonBlock className="h-6 w-32" delayMs={lane * 140} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 - lane }, (_, card) => (
                  <SkeletonCard key={card} delayMs={lane * 140 + card * 150} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'list' ? (
        <div className="flex w-full flex-col gap-2">
          {Array.from({ length: 6 }, (_, row) => (
            <SkeletonBlock
              key={row}
              className="h-12 w-full rounded-lg"
              delayMs={row * 100}
            />
          ))}
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, card) => (
            <SkeletonCard key={card} delayMs={card * 100} />
          ))}
        </div>
      )}
    </div>
  );
}
