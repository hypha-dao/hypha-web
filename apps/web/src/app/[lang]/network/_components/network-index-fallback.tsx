import { NetworkLoadingGrid } from '@hypha-platform/epics';

import { NetworkPageTitle } from './network-page-title';

const CARD_GRID = 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';

/**
 * Directory wait state. The map keeps the ocean ground instead of a gray mask.
 * List view keeps the space-card grid.
 */
export function NetworkIndexFallback({ view }: { view?: string }) {
  const list = view === 'list';

  return (
    <div className="flex min-w-0 flex-col gap-4 xl:gap-9" aria-busy="true">
      <NetworkPageTitle />
      {list ? (
        <NetworkLoadingGrid count={8} cardGridClassName={CARD_GRID} />
      ) : (
        <div
          className="aspect-[2/1] w-full bg-[var(--hypha-paper)] dark:bg-[var(--hypha-ink)]"
          aria-hidden
        />
      )}
    </div>
  );
}
