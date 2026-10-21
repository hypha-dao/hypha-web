import { NetworkLoadingGrid, NetworkMapWave } from '@hypha-platform/epics';

import { NetworkPageTitle } from './network-page-title';

const CARD_GRID = 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';

/**
 * Directory wait state. Map and overview keep the globe mark. List keeps the
 * space-card grid. Same quiet sweep as home, different shapes.
 */
export function NetworkIndexFallback({ view }: { view?: string }) {
  const showMap = view !== 'list';
  const showCards = view !== 'map';

  return (
    <div className="flex min-w-0 flex-col gap-4 xl:gap-9" aria-busy="true">
      <NetworkPageTitle />
      {showMap ? <NetworkMapWave /> : null}
      {showCards ? (
        <NetworkLoadingGrid count={8} cardGridClassName={CARD_GRID} />
      ) : null}
    </div>
  );
}
