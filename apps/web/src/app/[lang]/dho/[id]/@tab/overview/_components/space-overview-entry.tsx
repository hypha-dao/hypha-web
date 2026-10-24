'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSpaceEnergy } from '@hypha-platform/epics';
import { Debug2575Boundary, Debug2575Lifecycle } from './debug-2575';

/**
 * Energy communities open on the energy dashboard. Overview stays available
 * when the menu asks for the space dashboard (`board=space`) or an invite is open.
 */
const renderStamps2575: number[] = [];

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
  const now = Date.now();
  renderStamps2575.push(now);
  while (
    renderStamps2575.length > 0 &&
    now - (renderStamps2575[0] ?? now) > 1000
  ) {
    renderStamps2575.shift();
  }
  console.log('[#2575] SpaceOverviewEntry render', {
    rendersLastSecond: renderStamps2575.length,
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

  return (
    <Debug2575Boundary>
      <Debug2575Lifecycle name="overview children" />
      {children}
    </Debug2575Boundary>
  );
}
