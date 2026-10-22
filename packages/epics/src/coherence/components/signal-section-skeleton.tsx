'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Wave } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import type { SignalViewMode } from './signal-section';

function SkeletonBlock({
  className,
  delayMs = 0,
}: {
  className?: string;
  delayMs?: number;
}) {
  return <Wave className={cn('rounded-none', className)} delayMs={delayMs} />;
}

function SkeletonCard({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div
      className="rounded-none border border-border/50 bg-transparent p-3"
      aria-hidden
    >
      <Wave className="h-3 w-3/4" delayMs={delayMs} />
      <Wave className="mt-2 h-3 w-1/2" delayMs={delayMs + 40} />
      <div className="mt-4 flex items-center gap-2">
        <Wave className="h-3 w-14" delayMs={delayMs + 80} />
        <Wave className="h-3 w-9" delayMs={delayMs + 120} />
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
        <div className="flex w-full overflow-hidden">
          {[0, 1, 2, 3].map((column) => (
            <div
              key={column}
              className="flex min-w-0 flex-1 flex-col gap-2 border-r border-border/50 p-2 last:border-r-0"
            >
              <SkeletonBlock className="h-6 w-24" delayMs={column * 120} />
              {Array.from({ length: 3 - (column % 2) }, (_, card) => (
                <SkeletonCard key={card} delayMs={column * 120 + card * 150} />
              ))}
            </div>
          ))}
        </div>
      ) : viewMode === 'swimlane' ? (
        <div className="flex w-full flex-col">
          {[0, 1, 2].map((lane) => (
            <div
              key={lane}
              className="flex flex-col gap-2 border-b border-border/50 py-2"
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
              className="h-12 w-full rounded-none border-b border-border/40 bg-transparent"
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
