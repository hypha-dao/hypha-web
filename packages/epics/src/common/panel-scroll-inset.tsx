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
 * Offcanvas sidebars overlay the inset at full viewport width; `PanelWrapLayout` sets
 * `--sidebar-left-width` / `--sidebar-right-width` so we pad the scroll column and
 * keep sticky chrome (e.g. MenuTop) out from under the fixed panels.
 */
export function PanelScrollInset({ className, ...props }: Props) {
  const bind = React.useCallback((node: HTMLElement | null) => {
    setMainColumnScrollRoot(node);
  }, []);

  return (
    <SidebarInset
      ref={bind}
      className={cn(
        'overflow-y-auto pl-[var(--sidebar-left-width,0px)] pr-[var(--sidebar-right-width,0px)]',
        className,
      )}
      {...props}
    />
  );
}
