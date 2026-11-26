'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMemberExperience, useSpaceEnergy } from '@hypha-platform/epics';

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
  const { liveIsMember, profileSettled } = useMemberExperience();
  const pathname = usePathname();
  const router = useRouter();
  // Members land on the space home. Energy stays its own screen in their menu.
  // Wait for the live profile — a remembered cookie must not bounce members.
  const energyHome =
    !stay && profileSettled && !liveIsMember && data?.enabled === true;

  useEffect(() => {
    if (!energyHome || !pathname) return;
    const energyPath = pathname.replace(/\/overview\/?$/, '/energy');
    if (energyPath !== pathname) router.replace(energyPath);
  }, [energyHome, pathname, router]);

  const waiting = !stay && !error && (isLoading || data == null);
  if (energyHome || waiting) return null;

  return children;
}
