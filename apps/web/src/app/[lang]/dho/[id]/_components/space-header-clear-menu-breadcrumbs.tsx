'use client';

import { useSetMenuBreadcrumb } from '@web/components/menu-breadcrumb-context';
import { useLayoutEffect } from 'react';

/** Breadcrumbs render on the hero — keep global MenuTop clear on DHO */
export function SpaceHeaderClearMenuBreadcrumbs() {
  const setSlot = useSetMenuBreadcrumb();

  useLayoutEffect(() => {
    setSlot(null);
    return () => setSlot(null);
  }, [setSlot]);

  return null;
}
