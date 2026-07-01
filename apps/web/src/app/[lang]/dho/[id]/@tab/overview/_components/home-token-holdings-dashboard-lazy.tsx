'use client';

import dynamic from 'next/dynamic';
import { TabLoadingSkeleton } from '../../_components/tab-loading-skeleton';

/**
 * The overview dashboard pulls in d3 (a large dependency) and only ever renders
 * client-side (SWR fetches gated on the Privy access token). Lazy-loading it via
 * `next/dynamic` keeps the d3 chunk off the initial hydration path and shows a
 * skeleton while it streams in.
 */
const HomeTokenHoldingsDashboard = dynamic(
  () =>
    import('./home-token-holdings-dashboard').then(
      (mod) => mod.HomeTokenHoldingsDashboard,
    ),
  {
    ssr: false,
    loading: () => <TabLoadingSkeleton showTitle={false} />,
  },
);

export function HomeTokenHoldingsDashboardLazy({
  spaceSlug,
}: {
  spaceSlug: string;
}) {
  return <HomeTokenHoldingsDashboard spaceSlug={spaceSlug} />;
}
