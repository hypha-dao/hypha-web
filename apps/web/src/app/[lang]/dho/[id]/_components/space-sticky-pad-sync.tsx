'use client';

import { useEffect } from 'react';

import { useSpaceHeaderMorph } from './space-header-morph-context';

/** Approx max height of fixed strip (breadcrumb row + compact bar). */
const MAX_STICKY_STACK_PX = 108;

function smoothPad(p: number) {
  /* Ease padding in so content pushes down before strip fully occludes cards */
  const t = Math.min(1, Math.max(0, (p - 0.06) / 0.94));
  return Math.round(t * t * MAX_STICKY_STACK_PX);
}

/**
 * Reserves vertical space below MenuTop while fixed space chrome is visible,
 * so tab/content is not covered by portal layers.
 */
export function SpaceStickyPadSync() {
  const { progress } = useSpaceHeaderMorph();

  useEffect(() => {
    const px = smoothPad(progress);
    document.documentElement.style.setProperty('--dho-sticky-pad', `${px}px`);
    return () => {
      document.documentElement.style.removeProperty('--dho-sticky-pad');
    };
  }, [progress]);

  return null;
}
