'use client';

import * as React from 'react';
import { cn } from '@hypha-platform/ui-utils';

/**
 * Energy loading placeholders. Uses pulse blocks directly — the shared UI
 * `Skeleton` only paints when `loading` is set, which is easy to miss.
 */

function Pulse({
  className,
  delayMs = 0,
  style,
}: {
  className?: string;
  delayMs?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn('motion-safe:animate-pulse rounded-md bg-muted', className)}
      style={delayMs ? { ...style, animationDelay: `${delayMs}ms` } : style}
      aria-hidden
    />
  );
}

/** Single text-line placeholder. */
export function EnergyTextSkeleton({
  className,
  delayMs,
}: {
  className?: string;
  delayMs?: number;
}) {
  return (
    <Pulse className={cn('h-4 max-w-full', className)} delayMs={delayMs} />
  );
}

/** Matches {@link StatCard} layout (label + large value). */
export function EnergyStatCardSkeleton({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div
      className="relative overflow-hidden craft-card p-4"
      aria-hidden
    >
      <span className="absolute inset-x-0 top-0 h-0.5 bg-muted" />
      <Pulse className="h-3 w-24" delayMs={delayMs} />
      <Pulse className="mt-3 h-7 w-32" delayMs={delayMs + 80} />
    </div>
  );
}

export function EnergyStatCardsSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3',
        count === 2 && 'sm:grid-cols-2',
        count === 3 && 'sm:grid-cols-3',
        count >= 4 && 'sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
      role="status"
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <EnergyStatCardSkeleton key={i} delayMs={i * 90} />
      ))}
    </div>
  );
}

/** Bar-chart shaped placeholder with staggered bar heights. */
export function EnergyChartSkeleton({
  height = 192,
  bars = 10,
  className,
}: {
  height?: number;
  bars?: number;
  className?: string;
}) {
  const heights = React.useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => {
        // Deterministic wave so SSR/client match and bars feel intentional.
        const t = (i / Math.max(bars - 1, 1)) * Math.PI;
        return 28 + Math.round((Math.sin(t) * 0.5 + 0.5) * 55);
      }),
    [bars],
  );

  return (
    <div
      className={cn(
        'flex w-full items-end justify-between gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-3 pb-3 pt-6',
        className,
      )}
      style={{ height }}
      role="status"
      aria-busy="true"
    >
      {heights.map((pct, i) => (
        <Pulse
          key={i}
          className="min-w-0 flex-1 rounded-t-sm rounded-b-none"
          delayMs={i * 70}
          style={{ height: `${pct}%` }}
        />
      ))}
    </div>
  );
}

/** Person/list row placeholder (avatar + two text lines). */
export function EnergyPersonRowSkeleton({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div
      className="flex items-center gap-3 craft-card p-3"
      aria-hidden
    >
      <Pulse className="h-10 w-10 shrink-0 rounded-full" delayMs={delayMs} />
      <div className="min-w-0 flex-1 space-y-2">
        <Pulse className="h-4 w-36 max-w-full" delayMs={delayMs + 60} />
        <Pulse className="h-3 w-24 max-w-full" delayMs={delayMs + 120} />
      </div>
      <Pulse
        className="h-6 w-14 shrink-0 rounded-full"
        delayMs={delayMs + 90}
      />
    </div>
  );
}

/** Initial Energy section load — stats + tab panel shell. */
export function EnergySectionSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true">
      <EnergyStatCardsSkeleton count={3} />
      <div className="flex flex-col gap-4">
        <Pulse className="h-10 w-full max-w-xl rounded-full" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <EnergyPersonRowSkeleton key={i} delayMs={i * 100} />
          ))}
        </div>
        <EnergyChartSkeleton height={220} bars={12} className="mt-2" />
      </div>
    </div>
  );
}
