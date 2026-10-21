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
 * Map wait mark: a globe with a few pins. Same sweep as home, different shape.
 */
export function NetworkMapWave({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative flex aspect-[2/1] w-full items-center justify-center overflow-hidden border border-border',
        className,
      )}
      aria-hidden
    >
      <Wave className="absolute inset-0" />
      <span className="relative size-[min(42%,16rem)]">
        <Wave className="absolute inset-0 rounded-full" delayMs={80} />
        <Wave
          className="absolute top-[36%] left-[28%] size-2 rounded-full"
          delayMs={160}
        />
        <Wave
          className="absolute top-[28%] left-[48%] size-2 rounded-full"
          delayMs={220}
        />
        <Wave
          className="absolute top-[48%] right-[30%] size-2 rounded-full"
          delayMs={280}
        />
      </span>
    </div>
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
