'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMe } from '@hypha-platform/core/client';
import { useSpaceEnergy } from '@hypha-platform/epics';

/**
 * Energy communities open on the energy dashboard. Overview stays available
 * when the menu asks for the space dashboard (`board=space`) or an invite is open.
 */
export function SpaceOverviewEntry({
  spaceSlug,
  stay,
  children,
}: {
  spaceSlug: string;
  stay: boolean;
  children: ReactNode;
}) {
  const { data, isLoading, error } = useSpaceEnergy(spaceSlug);
  const { person, isLoading: personLoading } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  // Members land on the space home. Energy stays its own screen in their menu.
  const energyHome =
    !stay &&
    !personLoading &&
    person?.primaryOrientation !== 'member' &&
    data?.enabled === true;

  useEffect(() => {
    if (!energyHome || !pathname) return;
    const energyPath = pathname.replace(/\/overview\/?$/, '/energy');
    if (energyPath !== pathname) router.replace(energyPath);
  }, [energyHome, pathname, router]);

  const waiting = !stay && !error && (isLoading || data == null);
  if (energyHome || waiting) return null;

  return children;
}
