'use client';

import { useLayoutEffect } from 'react';

import { useSpaceHeaderMorph } from './space-header-morph-context';

const FIXED_ACTIONS_STRIP_PX = 64;

/**
 * Reserves space when the fixed actions mirror strip is shown
 * so page content is not covered.
 */
export function SpaceStickyPadSync() {
  const { compactActionsMirror, progress } = useSpaceHeaderMorph();

  useLayoutEffect(() => {
    if (!compactActionsMirror) {
      document.documentElement.style.setProperty('--dho-sticky-pad', '0px');
      return () => {
        document.documentElement.style.removeProperty('--dho-sticky-pad');
      };
    }
    const fade = Math.min(1, Math.max(0, progress));
    const px = Math.round(FIXED_ACTIONS_STRIP_PX * fade);
    document.documentElement.style.setProperty('--dho-sticky-pad', `${px}px`);
    return () => {
      document.documentElement.style.removeProperty('--dho-sticky-pad');
    };
  }, [compactActionsMirror, progress]);

  return null;
}
