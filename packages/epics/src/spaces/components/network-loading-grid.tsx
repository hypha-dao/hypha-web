'use client';

import { Wave } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

type NetworkLoadingGridProps = {
  count?: number;
  cardGridClassName?: string;
};

/** A space card, not a home bar: banner, mark, then text. Same sweep. */
function SpaceCardPlaceholder({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div className="craft-card flex h-full w-full flex-col" aria-hidden>
      <Wave className="h-[120px] w-full" delayMs={delayMs} />
      <div className="relative flex flex-1 flex-col gap-2 p-3.5 pt-4">
        <Wave
          className="absolute -top-12 size-14 rounded-full"
          delayMs={delayMs + 40}
        />
        <Wave className="mt-1 h-5 w-2/3" delayMs={delayMs + 80} />
        <Wave className="h-3 w-full" delayMs={delayMs + 120} />
        <Wave className="h-3 w-4/5" delayMs={delayMs + 160} />
        <div className="mt-auto flex items-center gap-3 pt-3">
          <Wave className="h-3 w-16" delayMs={delayMs + 200} />
          <Wave className="h-3 w-16" delayMs={delayMs + 240} />
          <Wave className="h-3 w-20" delayMs={delayMs + 280} />
        </div>
      </div>
    </div>
  );
}

/**
 * Map wait mask: the map plane as one Wave bar — same sweep as home, not dots.
 */
export function NetworkMapWave({ className }: { className?: string }) {
  return (
    <Wave
      className={cn('aspect-[2/1] w-full border border-border', className)}
    />
  );
}

/** Loading grid shaped like the space cards on the explore page. */
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
        <SpaceCardPlaceholder key={index} delayMs={index * 70} />
      ))}
    </div>
  );
}
