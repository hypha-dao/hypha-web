'use client';

import * as React from 'react';
import { SidebarInset } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { setMainColumnScrollRoot } from './main-column-scroll';

type Props = React.ComponentProps<typeof SidebarInset>;

/**
 * `SidebarInset` that registers itself as the main column scroll root for parallax /
 * sticky chrome when this inset is the scrollport (`overflow-y-auto`).
 *
 * Do not add horizontal padding for open sidebars here: `Sidebar`’s gap element already
 * reserves width in the flex row, so extra padding would double-count and shrink content.
 * Viewport-fixed layers (dialogs, DHO sticky chrome) use `--sidebar-*-width` on their own.
 */
export function PanelScrollInset({ className, ...props }: Props) {
  const bind = React.useCallback((node: HTMLElement | null) => {
    setMainColumnScrollRoot(node);
  }, []);

  return (
    <SidebarInset
      ref={bind}
      className={cn('overflow-y-auto', className)}
      {...props}
    />
  );
}
