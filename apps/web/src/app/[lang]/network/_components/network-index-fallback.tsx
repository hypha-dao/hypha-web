import { NetworkDirectoryMask } from '@hypha-platform/epics';

import { NetworkPageTitle } from './network-page-title';

/**
 * Directory wait state shaped like the loaded page: search, tags, census,
 * map plane with pins, and space cards — not a blank box.
 */
export function NetworkIndexFallback({ view }: { view?: string }) {
  return <NetworkDirectoryMask view={view} title={<NetworkPageTitle />} />;
}
