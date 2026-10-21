import { NetworkLoadingGrid } from '@hypha-platform/epics';
import { cn } from '@hypha-platform/ui-utils';

import { NetworkPageTitle } from './network-page-title';

const CARD_GRID = 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';

function Pulse({ className }: { className: string }) {
  return (
    <div
      className={cn(
        'bg-foreground/10 motion-safe:animate-pulse motion-reduce:animate-none',
        className,
      )}
      aria-hidden
    />
  );
}

/** Same mark the map uses while places are still resolving. */
function MapPlaceholder() {
  return (
    <div
      className="relative h-56 w-full overflow-hidden border border-neutral-4 bg-neutral-2 sm:h-72"
      aria-hidden
    >
      <span className="absolute top-1/2 left-1/2 size-[min(42%,16rem)] -translate-x-1/2 -translate-y-1/2 motion-safe:animate-pulse motion-reduce:animate-none">
        <span className="absolute inset-0 rounded-full border border-neutral-6 bg-neutral-4" />
        <span className="absolute top-[36%] left-[28%] size-2 rounded-full bg-neutral-8" />
        <span className="absolute top-[28%] left-[48%] size-2 rounded-full bg-neutral-8" />
        <span className="absolute top-[48%] right-[30%] size-2 rounded-full bg-neutral-8" />
      </span>
    </div>
  );
}

/**
 * Directory wait state. Overview shows the map mark and the space-card grid.
 * List and map follow the same shapes as the loaded page.
 */
export function NetworkIndexFallback({ view }: { view?: string }) {
  const showMap = view !== 'list';
  const showCards = view !== 'map';

  return (
    <div className="flex min-w-0 flex-col gap-4 xl:gap-9" aria-busy="true">
      <NetworkPageTitle />
      <div className="flex min-w-0 items-center gap-3">
        <Pulse className="h-10 min-w-0 flex-1 border border-neutral-4" />
        <Pulse className="h-10 w-28 shrink-0" />
      </div>
      {showMap ? (
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex gap-2">
            <Pulse className="h-8 w-24" />
            <Pulse className="h-8 w-20" />
            <Pulse className="h-8 w-16" />
          </div>
          <div className="grid grid-cols-2 border border-border md:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className={cn(
                  'flex flex-col gap-2 px-4 py-3 md:items-center',
                  index % 2 === 1 && 'border-l border-border',
                  index >= 2 && 'border-t border-border md:border-t-0',
                  index > 0 && 'md:border-l',
                )}
              >
                <Pulse className="h-8 w-16" />
                <Pulse className="h-3 w-20" />
              </div>
            ))}
          </div>
          <MapPlaceholder />
        </div>
      ) : null}
      {showCards ? (
        <NetworkLoadingGrid count={8} cardGridClassName={CARD_GRID} />
      ) : null}
    </div>
  );
}
