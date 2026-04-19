'use client';

import { useEffect } from 'react';

import { useSpaceHeaderMorph } from './space-header-morph-context';

/** Approx max height of compact bar portal only (breadcrumbs live in MenuTop). */
const MAX_STICKY_STACK_PX = 56;

function padPx(p: number) {
  /* Linear — avoids “two-step” feel vs hero morph */
  const t = Math.min(1, Math.max(0, p));
  return Math.round(t * MAX_STICKY_STACK_PX);
}

/**
 * Reserves vertical space below MenuTop while fixed space chrome is visible,
 * so tab/content is not covered by portal layers.
 */
export function SpaceStickyPadSync() {
  const { progress } = useSpaceHeaderMorph();

  useEffect(() => {
    const px = padPx(progress);
    document.documentElement.style.setProperty('--dho-sticky-pad', `${px}px`);
    return () => {
      document.documentElement.style.removeProperty('--dho-sticky-pad');
    };
  }, [progress]);

  return null;
}
