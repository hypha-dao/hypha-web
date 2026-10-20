'use client';

import { cn } from '@hypha-platform/ui-utils';

type NetworkLoadingGridProps = {
  count?: number;
  cardGridClassName?: string;
};

function SpaceCardPlaceholder() {
  return (
    <div className="craft-card flex h-full w-full flex-col" aria-hidden>
      <div className="h-[120px] bg-foreground/10 motion-safe:animate-pulse motion-reduce:animate-none" />
      <div className="relative flex flex-1 flex-col gap-2 p-3.5 pt-4">
        <div className="absolute -top-12 size-14 rounded-full bg-foreground/15 motion-safe:animate-pulse motion-reduce:animate-none" />
        <div className="mt-1 h-5 w-2/3 bg-foreground/10 motion-safe:animate-pulse motion-reduce:animate-none" />
        <div className="h-3 w-full bg-foreground/[0.07] motion-safe:animate-pulse motion-reduce:animate-none" />
        <div className="h-3 w-4/5 bg-foreground/[0.07] motion-safe:animate-pulse motion-reduce:animate-none" />
        <div className="mt-auto flex items-center gap-3 pt-3">
          <div className="h-3 w-16 bg-foreground/10 motion-safe:animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-16 bg-foreground/10 motion-safe:animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-20 bg-foreground/10 motion-safe:animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
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
        <SpaceCardPlaceholder key={index} />
      ))}
    </div>
  );
}
