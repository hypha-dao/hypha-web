'use client';

import { useLayoutEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { scrollMainColumnTo } from '@hypha-platform/epics';

/** The wallet column is not the window, so a second visit can restore a
 * scroll offset past the action. Pin the top whenever the wallet route changes. */
export function WalletColumnScrollReset() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useLayoutEffect(() => {
    if (!pathname.includes('/my-wallet/actions')) return;
    scrollMainColumnTo(0, 'auto');
    const frame = requestAnimationFrame(() => scrollMainColumnTo(0, 'auto'));
    return () => cancelAnimationFrame(frame);
  }, [pathname, search]);

  return null;
}
