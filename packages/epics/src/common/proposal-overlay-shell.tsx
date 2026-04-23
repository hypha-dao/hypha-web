'use client';

import type { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AsideOverlayLayoutProvider } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { useSpaceAccentPortalStyles } from '../spaces/components/space-accent-portal-context';

type ProposalOverlayShellProps = {
  children: ReactNode;
  /** Merged onto the inner scroll panel (after defaults) — use for narrower modals e.g. member profile. */
  className?: string;
};

/**
 * Presentation shell for primary @aside flows (proposals, space settings menus,
 * configure space, create signal modal, etc.).
 *
 * Mobile / tablet portrait: docked sheet (respects `--menu-top-height` and
 * `--sidebar-right-width`).
 *
 * `md` and up: centered overlay using **Radix** `DialogPrimitive.Content` from
 * `@radix-ui/react-dialog` (built-in `role="dialog"` + focus scope + screen-reader
 * wiring). We intentionally **do not** wrap `packages/ui`’s `Dialog`/`DialogContent`
 * here: those render a bundled overlay + default close control and fight
 * parallel-route close + `z-index` rules (Dropdown/Popover portaled to `body`,
 * {@link MenuTop} at `z-30`).
 *
 * **Non-modal** `DialogPrimitive.Root` (`modal={false}`): does not trap focus or
 * inert sibling trees, so Human/AI side panels stay interactive (open, close,
 * type) while this overlay is open. Escape and scrim dismissal stay suppressed
 * so close remains on in-app routes.
 *
 * Plain scrim: we still render the scrim `div` ourselves (aligned with MenuTop).
 *
 * **Portals:** `DialogPrimitive.Portal` renders under `document.body`. `--sidebar-*` and
 * `--main-column-scrollbar-width` are mirrored onto `document.documentElement` by
 * {@link PanelWrapLayout} so fixed positioning math matches the main column.
 *
 * **MenuTop:** `layout.tsx` uses `z-30` for the nav strip. Scrim and host sit above it
 * (`z-40` / `z-[41]`) so the overlay dims the main column; AI/Human sidebars use
 * `z-[50]` ({@link PanelWrapLayout}) so they stay above the scrim and usable.
 *
 * Body scroll is not locked so main column / panels can scroll while the overlay is open.
 *
 * Default desktop footprint is intentionally modest (narrower max-width + lower max-height, larger
 * host padding) so the panel does not dominate the center column; pass {@link className} to
 * override per flow (e.g. member profile).
 */
export function ProposalOverlayShell({
  children,
  className,
}: ProposalOverlayShellProps) {
  const tModalAside = useTranslations('ModalAside');
  const spaceAccentPortalStyle = useSpaceAccentPortalStyles();

  return (
    <AsideOverlayLayoutProvider mode="modal-shell">
      <DialogPrimitive.Root modal={false} open>
        <DialogPrimitive.Portal>
          {/* Plain scrim below MenuTop (z-30); starts under --menu-top-height */}
          <div
            className={cn(
              'fixed bottom-0 z-40 hidden bg-black/45 backdrop-blur-md supports-[backdrop-filter]:bg-black/35 md:block',
              'left-[var(--sidebar-left-width,0px)] right-[calc(var(--sidebar-right-width,0px)+var(--main-column-scrollbar-width,10px))]',
              'top-[var(--menu-top-height,65px)]',
            )}
            aria-hidden
          />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            className={cn(
              'fixed z-[41] outline-none max-md:inset-auto max-md:bottom-0 max-md:left-[var(--sidebar-left-width,0px)] max-md:top-[var(--menu-top-height,65px)] max-md:right-[calc(var(--sidebar-right-width,0px)+var(--main-column-scrollbar-width,10px))] max-md:h-auto max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:bg-background-2 max-md:shadow-none',
              // Host fills main column from top of viewport; horizontal bounds match inset when panels are open.
              'md:left-[var(--sidebar-left-width,0px)] md:right-[calc(var(--sidebar-right-width,0px)+var(--main-column-scrollbar-width,10px))] md:bottom-0 md:top-0 md:flex md:items-center md:justify-center md:overflow-hidden md:bg-transparent md:p-6 md:pt-[max(1rem,var(--menu-top-height,65px))]',
            )}
          >
            <DialogPrimitive.Title className="sr-only">
              {tModalAside('panelAccessibleName')}
            </DialogPrimitive.Title>
            <div
              className={cn(
                'relative flex w-full min-h-0 flex-col outline-none md:mx-auto md:max-h-[min(560px,calc(100dvh_-_var(--menu-top-height,65px)_-_3rem))] md:max-w-[min(640px,calc(100vw_-_var(--sidebar-left-width,0px)_-_var(--sidebar-right-width,0px)_-_var(--main-column-scrollbar-width,10px)_-_3rem))]',
                'md:z-10 md:flex-initial md:overflow-y-auto md:rounded-2xl md:border md:border-border/90 md:bg-background-2 md:shadow-2xl md:ring-1 md:ring-white/5 dark:md:ring-white/10',
                'max-md:max-h-[calc(100dvh_-_var(--menu-top-height,65px))] max-md:overflow-y-auto',
                'narrow-scrollbar',
                className,
              )}
              id="proposal-overlay-panel"
              role="document"
              tabIndex={-1}
              style={spaceAccentPortalStyle}
              data-space-accent-scope
            >
              <div className="p-4 lg:p-7">{children}</div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </AsideOverlayLayoutProvider>
  );
}
