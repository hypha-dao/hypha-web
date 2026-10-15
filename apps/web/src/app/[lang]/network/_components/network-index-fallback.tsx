import { NetworkLoadingGrid } from '@hypha-platform/epics';

import { NetworkPageTitle } from './network-page-title';

export function NetworkIndexFallback() {
  return (
    <div className="flex min-w-0 flex-col gap-9" aria-busy="true">
      <NetworkPageTitle />
      <div className="flex min-w-0 flex-col gap-4">
        <div className="h-10 w-full animate-pulse rounded-md border border-neutral-4 bg-neutral-2" />
        <NetworkLoadingGrid
          count={12}
          cardGridClassName="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        />
      </div>
    </div>
  );
}
