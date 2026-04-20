'use client';

import { useLayoutEffect } from 'react';

import { useSpaceHeaderMorph } from './space-header-morph-context';

const COMPACT_BAR_PX = 64;

/**
 * Reserves space when the fixed compact bar (duplicated actions) is shown
 * so page content is not covered.
 */
export function SpaceStickyPadSync() {
  const { compactBarActive, progress } = useSpaceHeaderMorph();

  useLayoutEffect(() => {
    if (!compactBarActive) {
      document.documentElement.style.setProperty('--dho-sticky-pad', '0px');
      return () => {
        document.documentElement.style.removeProperty('--dho-sticky-pad');
      };
    }
    const fade = Math.min(1, Math.max(0, progress));
    const px = Math.round(COMPACT_BAR_PX * fade);
    document.documentElement.style.setProperty('--dho-sticky-pad', `${px}px`);
    return () => {
      document.documentElement.style.removeProperty('--dho-sticky-pad');
    };
  }, [compactBarActive, progress]);

  return null;
}
