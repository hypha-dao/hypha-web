'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { getActiveTabFromPath } from './get-active-tab-from-path';

/**
 * When `wait` is true, stays false until the first paint plus idle (or
 * `timeoutMs`). When `wait` is false, returns true immediately.
 */
export function useAfterIdle(wait: boolean, timeoutMs = 1_200): boolean {
  const [ready, setReady] = React.useState(!wait);

  React.useEffect(() => {
    if (!wait) {
      setReady(true);
      return;
    }

    setReady(false);
    let idleId = 0;
    let timeoutId = 0;
    const enable = () => setReady(true);
    const afterPaint = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(enable, { timeout: timeoutMs });
        return;
      }
      timeoutId = window.setTimeout(enable, Math.min(400, timeoutMs));
    };
    const raf = window.requestAnimationFrame(afterPaint);

    return () => {
      window.cancelAnimationFrame(raf);
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      window.clearTimeout(timeoutId);
    };
  }, [timeoutMs, wait]);

  return wait ? ready : true;
}

/** Background fetches/prefetches wait until Overview has had the network. */
export function useEnergyOverviewIdleGate(): boolean {
  const pathname = usePathname();
  const onEnergy = getActiveTabFromPath(pathname) === 'energy';
  return useAfterIdle(onEnergy);
}
