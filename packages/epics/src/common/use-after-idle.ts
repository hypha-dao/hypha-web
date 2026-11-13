'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { useEnergySevenDaySettled } from './energy-seven-day-settled';
import { isEnergyTabPath } from './get-active-tab-from-path';

/**
 * When `wait` is true, stays false until the first paint plus idle (or
 * `timeoutMs`). When `wait` is false, returns true immediately.
 * A false→true flip resets on that render so callers do not skip the delay.
 */
export function useAfterIdle(wait: boolean, timeoutMs = 1_200): boolean {
  const [ready, setReady] = React.useState(!wait);
  const [armedWait, setArmedWait] = React.useState(wait);

  if (wait !== armedWait) {
    setArmedWait(wait);
    setReady(!wait);
  }

  React.useEffect(() => {
    if (!wait) {
      return;
    }

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

/**
 * `next/link` prefetch: `false` while waiting, `null` (viewport auto) when
 * ready. `true` is a full-route prefetch and would add background fetches.
 */
export function toLinkPrefetch(ready: boolean): boolean | null {
  return ready ? null : false;
}

/** Background fetches wait until 7d telemetry has settled on `/energy`. */
export function useEnergyOverviewIdleGate(): boolean {
  const pathname = usePathname();
  const sevenDaySettled = useEnergySevenDaySettled();
  // Fail closed until the router has a path — an empty first paint used to
  // look like overview and fire intelligence on `/energy`.
  if (!pathname) return false;
  if (!isEnergyTabPath(pathname)) return true;
  return sevenDaySettled;
}

/** Drop a SWR key while the energy route is still waiting on 7d. */
export function useEnergyGatedSWRKey<T>(key: T | null | undefined): T | null {
  const ready = useEnergyOverviewIdleGate();
  if (!ready || key == null) return null;
  return key;
}
