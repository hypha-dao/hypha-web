'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { landingTab } from '@web/lib/white-label/tabs';
import { sectionHref, sectionSegment } from '@web/lib/white-label/link';
import { landingFallback } from '@web/lib/white-label/nav';
import { useWhiteLabel } from './white-label-provider';
import { useTabAvailability } from './use-tab-availability';

/**
 * A client's landing is the first tab it lists. When this Space cannot serve
 * that tab (energy on a Space that is not an energy community, a pipeline the
 * visitor cannot read), the bare path goes to the first listed tab it can,
 * once the Space's answer has loaded. Only the bare path: a URL that names a
 * section is left alone. Renders nothing.
 */
export function WhiteLabelTabLandingGuard({
  spaceSlug,
  coherenceEnabled,
  memoryEnabled,
}: {
  spaceSlug: string;
  coherenceEnabled: boolean;
  memoryEnabled: boolean;
}) {
  const ctx = useWhiteLabel();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { available, settled } = useTabAvailability(spaceSlug, {
    coherenceEnabled,
    memoryEnabled,
  });

  const landing = ctx ? landingTab(ctx.tabs) : null;
  const ready =
    landing === 'energy'
      ? settled.energy
      : landing === 'pipeline'
      ? settled.pipeline
      : true;
  const bare = ctx ? sectionSegment(ctx, pathname) === undefined : false;
  const target =
    ctx && bare && ready ? landingFallback(ctx.tabs, available) : null;

  useEffect(() => {
    if (ctx && target) router.replace(sectionHref(ctx, target));
  }, [ctx, target, router]);

  return null;
}
