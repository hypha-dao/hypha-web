'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSpaceEnergy } from '@hypha-platform/epics';
import { useWhiteLabelSectionHref } from './white-label-provider';

/**
 * White-label counterpart of the main app's overview entry: an energy
 * community opens on its energy dashboard. The target comes from the
 * white-label context, not from the pathname.
 */
export function WhiteLabelOverviewEntry({
  spaceSlug,
  stay,
  children,
}: {
  spaceSlug: string;
  stay: boolean;
  children: ReactNode;
}) {
  const { data, isLoading, error } = useSpaceEnergy(spaceSlug);
  const router = useRouter();
  const sectionHref = useWhiteLabelSectionHref();
  const energyHome = !stay && data?.enabled === true;

  useEffect(() => {
    if (energyHome) router.replace(sectionHref('energy'));
  }, [energyHome, router, sectionHref]);

  const waiting = !stay && !error && (isLoading || data == null);
  if (energyHome || waiting) return null;
  return children;
}
