'use client';

import { useEffect } from 'react';

import { useSpaceHeaderMorph } from './space-header-morph-context';

function parseCssPx(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function SpaceStickyPadSync() {
  const { progress, compactActionsAbsorbed, actionsRowHeightPx } =
    useSpaceHeaderMorph();

  useEffect(() => {
    const idH = parseCssPx(
      getComputedStyle(document.documentElement).getPropertyValue(
        '--dho-identity-strip-h',
      ),
    );

    const rowH = actionsRowHeightPx > 8 ? actionsRowHeightPx : 52;

    let pad = 0;
    if (progress > 0.08) {
      pad = idH;
      if (progress > 0.12) {
        if (compactActionsAbsorbed || progress > 0.14) {
          pad += rowH;
        }
      }
    }

    document.documentElement.style.setProperty(
      '--dho-sticky-pad',
      `${Math.round(pad)}px`,
    );
    return () => {
      document.documentElement.style.removeProperty('--dho-sticky-pad');
    };
  }, [progress, compactActionsAbsorbed, actionsRowHeightPx]);

  return null;
}
