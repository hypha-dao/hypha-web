'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSpaceEnergy } from '@hypha-platform/epics';

/**
 * Energy communities open on the energy dashboard. Overview stays available
 * when the menu asks for the space dashboard (`board=space`) or an invite is open.
 */
export function SpaceOverviewEntry({
  stay,
  children,
}: {
  stay: boolean;
  children: ReactNode;
}) {
  const { data, isLoading, error } = useSpaceEnergy();
  const pathname = usePathname();
  const router = useRouter();
  const energyHome = !stay && data?.enabled === true;

  useEffect(() => {
    if (!energyHome || !pathname) return;
    const energyPath = pathname.replace(/\/overview\/?$/, '/energy');
    if (energyPath !== pathname) router.replace(energyPath);
  }, [energyHome, pathname, router]);

  const waiting = !stay && !error && (isLoading || data == null);
  // TEMP(#2575)
  console.log('[#2575] SpaceOverviewEntry render', {
    pathname,
    search: typeof window !== 'undefined' ? window.location.search : null,
    stay,
    isLoading,
    hasData: data != null,
    enabled: data?.enabled,
    energyHome,
    waiting,
  });
  if (energyHome || waiting) return null;

  return children;
}
