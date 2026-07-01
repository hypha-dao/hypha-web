'use client';

import React from 'react';
import { cn } from '@hypha-platform/ui-utils';

type NetworkLoadingGridProps = {
  count?: number;
  cardGridClassName?: string;
};

/**
 * Loading state for the network spaces grid. Instead of plain pulsing blocks it
 * renders placeholder "space" cards that assemble themselves (staggered rise-in)
 * with a light sweep across each card and a small animated node constellation -
 * a nod to the "one vibrant network" theme - so the wait feels intentional. All
 * motion is disabled under `prefers-reduced-motion`.
 */
export function NetworkLoadingGrid({
  count = 12,
  cardGridClassName,
}: NetworkLoadingGridProps) {
  return (
    <div
      className={cn('grid w-full grid-cols-1 gap-4', cardGridClassName)}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="relative h-[228px] overflow-hidden rounded-lg border border-neutral-4 bg-neutral-2 p-5 animate-network-rise motion-reduce:animate-none"
          style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
        >
          {/* Diagonal light sweep */}
          <div className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-neutral-5/40 to-transparent motion-reduce:hidden" />

          {/* Header: avatar node + title lines */}
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0">
              <span className="absolute inset-0 rounded-full bg-accent-6/50 animate-ping motion-reduce:hidden" />
              <span className="absolute inset-0 rounded-full bg-neutral-4" />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-3 w-2/3 rounded-full bg-neutral-4" />
              <div className="h-2.5 w-2/5 rounded-full bg-neutral-3" />
            </div>
          </div>

          {/* Body lines */}
          <div className="mt-5 flex flex-col gap-2">
            <div className="h-2.5 w-full rounded-full bg-neutral-3" />
            <div className="h-2.5 w-11/12 rounded-full bg-neutral-3" />
            <div className="h-2.5 w-3/4 rounded-full bg-neutral-3" />
          </div>

          {/* Animated node constellation */}
          <div className="mt-6 flex items-center gap-2">
            {Array.from({ length: 4 }).map((__, node) => (
              <React.Fragment key={node}>
                <span
                  className="h-2.5 w-2.5 rounded-full bg-accent-7 animate-pulse motion-reduce:animate-none"
                  style={{ animationDelay: `${node * 180}ms` }}
                />
                {node < 3 ? (
                  <span className="h-px flex-1 bg-gradient-to-r from-accent-6/60 to-neutral-4" />
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
