'use client';

import * as React from 'react';
import { SidebarInset } from '@hypha-platform/ui';
import { setMainColumnScrollRoot } from './main-column-scroll';

type Props = React.ComponentProps<typeof SidebarInset>;

/**
 * `SidebarInset` that registers itself as the main column scroll root for parallax /
 * sticky chrome when this inset is the scrollport (`overflow-y-auto`).
 */
export function PanelScrollInset({ className, ...props }: Props) {
  const bind = React.useCallback((node: HTMLElement | null) => {
    setMainColumnScrollRoot(node);
  }, []);

  return <SidebarInset ref={bind} className={className} {...props} />;
}
