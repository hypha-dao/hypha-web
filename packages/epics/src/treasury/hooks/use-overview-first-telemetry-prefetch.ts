'use client';

import * as React from 'react';

/**
 * Overview must paint from `/energy` alone. 7d/30d Azure scans are useful
 * once Production is likely, but they compete with avatar/banner bytes if
 * they start in the same turn as the consumer grid.
 *
 * Prefetch starts after the first paint (idle, 1.2s cap). Opening a tab
 * other than Overview starts it immediately.
 */
export function useOverviewFirstTelemetryPrefetch(
  energyEnabled: boolean,
  tab: string,
): boolean {
  const [afterOverviewPaint, setAfterOverviewPaint] = React.useState(false);

  React.useEffect(() => {
    if (!energyEnabled) {
      setAfterOverviewPaint(false);
      return;
    }

    let idleId = 0;
    let timeoutId = 0;
    const enable = () => setAfterOverviewPaint(true);
    const afterPaint = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(enable, { timeout: 1_200 });
        return;
      }
      timeoutId = window.setTimeout(enable, 400);
    };
    const raf = window.requestAnimationFrame(afterPaint);

    return () => {
      window.cancelAnimationFrame(raf);
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      window.clearTimeout(timeoutId);
    };
  }, [energyEnabled]);

  return energyEnabled && (afterOverviewPaint || tab !== 'overview');
}
