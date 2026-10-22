import { NetworkLoadingGrid, NetworkMapWave } from '@hypha-platform/epics';

import { NetworkPageTitle } from './network-page-title';

const CARD_GRID = 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';

/**
 * Directory wait state. Map plane and space cards use the same Wave mask as
 * home — content-shaped bars, not a dotted spinner.
 */
export function NetworkIndexFallback({ view }: { view?: string }) {
  const showMap = view !== 'list';
  const showCards = view !== 'map';

  return (
    <div className="flex min-w-0 flex-col gap-4" aria-busy="true">
      <NetworkPageTitle />
      {showMap ? <NetworkMapWave /> : null}
      {showCards ? (
        <NetworkLoadingGrid count={8} cardGridClassName={CARD_GRID} />
      ) : null}
    </div>
  );
}
