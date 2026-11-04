'use client';

import { useLayoutEffect, type ReactNode } from 'react';
import { scrollMainColumnTo } from '@hypha-platform/epics';

/** A fresh instance on every action visit, so send (and the other actions)
 * do not reuse the first visit's client state. */
export default function WalletActionTemplate({
  children,
}: {
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    scrollMainColumnTo(0, 'auto');
  }, []);

  return children;
}
