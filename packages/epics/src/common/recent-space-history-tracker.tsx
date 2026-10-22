'use client';

import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';

import { getDhoSpaceSlugFromPathname } from './get-dho-space-slug-from-pathname';
import { syncRecentSpacesForActiveSlug } from './recent-space-history';

/**
 * Always-mounted visitor that records DHO space navigations into localStorage
 * so home / AI panel "Recently Visited" lists stay live — independent of the
 * AI chat feature flag (AiLeftPanel may be unmounted).
 */
export function RecentSpaceHistoryTracker() {
  const pathname = usePathname();
  const spaceSlug = useMemo(
    () => getDhoSpaceSlugFromPathname(pathname) ?? null,
    [pathname],
  );

  useEffect(() => {
    syncRecentSpacesForActiveSlug(spaceSlug);
  }, [spaceSlug]);

  return null;
}
