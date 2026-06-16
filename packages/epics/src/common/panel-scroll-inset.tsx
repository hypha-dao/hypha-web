'use client';

import * as React from 'react';
import { SidebarInset } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { HYPHA_SCREEN_SHARE_MAIN_CONTENT_ID } from '@hypha-platform/core/client';
import { setMainColumnScrollRoot } from './main-column-scroll';

export type PanelScrollInsetProps = Omit<
  React.ComponentPropsWithoutRef<typeof SidebarInset>,
  'ref'
>;

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null): void {
  if (ref == null) return;
  if (typeof ref === 'function') {
    ref(value);
  } else {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

/**
 * `SidebarInset` that registers itself as the main column scroll root for parallax /
 * sticky chrome when this inset is the scrollport (`overflow-y-auto`).
 *
 * Do not add horizontal padding for open sidebars here: `Sidebar`’s gap element already
 * reserves width in the flex row, so extra padding would double-count and shrink content.
 * Viewport-fixed layers (dialogs, DHO sticky chrome) use `--sidebar-*-width` on their own.
 *
 * Forwards ref and merges with the scroll-root binding so callers cannot override it
 * (CodeRabbit: `ref` in spread would replace a single internal ref).
 */
export const PanelScrollInset = React.forwardRef<
  HTMLDivElement,
  PanelScrollInsetProps
>(function PanelScrollInset({ className, style, ...props }, forwardedRef) {
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      setMainColumnScrollRoot(node);
      assignRef(forwardedRef, node);
    },
    [forwardedRef],
  );

  return (
    <SidebarInset
      id={HYPHA_SCREEN_SHARE_MAIN_CONTENT_ID}
      ref={setRefs}
      className={cn(
        /* No scrollbar-gutter — horizontal rules span full column width (may cross overlay scrollbar). */
        'overflow-y-auto narrow-scrollbar',
        className,
      )}
      style={
        {
          '--main-column-scrollbar-width': '0px',
          ...(style as React.CSSProperties | undefined),
        } as React.CSSProperties
      }
      {...props}
    />
  );
});

PanelScrollInset.displayName = 'PanelScrollInset';
