'use client';

import { useSetMenuBreadcrumb } from '@web/components/menu-breadcrumb-context';
import { useLayoutEffect, type ReactNode } from 'react';

export function SpaceHeaderMenuBridge({ children }: { children: ReactNode }) {
  const setSlot = useSetMenuBreadcrumb();

  useLayoutEffect(() => {
    setSlot(children);
    return () => setSlot(null);
  }, [children, setSlot]);

  return null;
}
