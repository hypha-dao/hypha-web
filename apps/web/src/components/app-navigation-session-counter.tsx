'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { APP_NAV_COUNT_KEY } from '@hypha-platform/epics';

export function AppNavigationSessionCounter() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(APP_NAV_COUNT_KEY);
      if (raw === null) {
        window.sessionStorage.setItem(APP_NAV_COUNT_KEY, '0');
        return;
      }
      const current = Number.parseInt(raw, 10);
      const next = Number.isFinite(current) ? current + 1 : 1;
      window.sessionStorage.setItem(APP_NAV_COUNT_KEY, String(next));
    } catch {
      // Ignore storage failures (private mode / blocked storage) and keep navigation functional.
    }
  }, [pathname]);

  return null;
}
