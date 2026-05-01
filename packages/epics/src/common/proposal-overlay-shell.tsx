'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AsideOverlayLayoutProvider } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { useSpaceAccentPortalStyles } from '../spaces/components/space-accent-portal-context';
import {
  popMainColumnOverlayScrollLock,
  pushMainColumnOverlayScrollLock,
} from './main-column-scroll';

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
 * On **`md+` the dialog host is `pointer-events-none`** so centered panels stay usable while
 * {@link MenuTop} remains reachable; the scrim must also use **`pointer-events-none`**, otherwise
 * hits pass through the host and are swallowed by the scrim (`z-40`), blocking the main column.
 *
 * **Portals:** `DialogPrimitive.Portal` renders under `document.body`. `--sidebar-*` and
 * `--main-column-scrollbar-width` are mirrored onto `document.documentElement` by
 * {@link PanelWrapLayout} so fixed positioning math matches the main column.
 *
 * **MenuTop:** `layout.tsx` uses `z-30` for the nav strip with AI/Human panel triggers.
 * The dialog **host** starts at **`--menu-top-height`** (not `top:0`) so it does not overlap the
 * menu strip. **`z-[41]`** still stacks above the menu; the host uses **`pointer-events-none`**
 * on **`md+`** so clicks pass through to the menu and panel triggers, while the inner panel uses
 * **`pointer-events-auto`** so the modal stays interactive. Sidebars use `z-[50]` above the scrim.
 *
 * While open, the **main column** scroll is **frozen** (so only the modal’s `narrow-scrollbar` is
 * active — no double vertical rails). Human/AI panel / page body are not locked.
 *
 * Default desktop max size is a **mid** footprint (between a narrow chooser and the old full-width
 * card); pass {@link className} to override per flow (e.g. member profile at 640px).
 */
export function ProposalOverlayShell({
  children,
  className,
}: ProposalOverlayShellProps) {
  const tModalAside = useTranslations('ModalAside');
  const spaceAccentPortalStyle = useSpaceAccentPortalStyles();
  const overlayPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pushMainColumnOverlayScrollLock();
    return () => {
      popMainColumnOverlayScrollLock();
    };
  }, []);

  /** Stronger scrollbar thumb while actively scrolling (WebKit + Firefox via class in narrow.css). */
  useEffect(() => {
    const el = overlayPanelRef.current;
    if (!el) return;
    let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;
    let raf = 0;

    const clearScrollingClass = () => {
      el.classList.remove('narrow-scrollbar-scrolling');
    };

    const onScroll = () => {
      el.classList.add('narrow-scrollbar-scrolling');
      if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
      scrollIdleTimer = setTimeout(() => {
        scrollIdleTimer = null;
        clearScrollingClass();
      }, 650);
    };

    const scheduleScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        onScroll();
      });
    };

    el.addEventListener('scroll', scheduleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', scheduleScroll);
      if (raf) cancelAnimationFrame(raf);
      if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
      clearScrollingClass();
    };
  }, []);

  return (
    <AsideOverlayLayoutProvider mode="modal-shell">
      <DialogPrimitive.Root modal={false} open>
        <DialogPrimitive.Portal>
          {/* Plain scrim below MenuTop (z-30); starts under --menu-top-height */}
          <div
            className={cn(
              'fixed bottom-0 z-40 hidden bg-black/45 backdrop-blur-md supports-[backdrop-filter]:bg-black/35 md:block',
              'md:pointer-events-none',
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
              /* Host is click-through on desktop so MenuTop (z-30) stays usable; modal surface re-enables hits */
              'pointer-events-auto md:pointer-events-none',
              'md:left-[var(--sidebar-left-width,0px)] md:right-[calc(var(--sidebar-right-width,0px)+var(--main-column-scrollbar-width,10px))] md:bottom-0 md:top-[var(--menu-top-height,65px)] md:flex md:items-center md:justify-center md:overflow-hidden md:bg-transparent md:p-5',
            )}
          >
            <DialogPrimitive.Title className="sr-only">
              {tModalAside('panelAccessibleName')}
            </DialogPrimitive.Title>
            {/*
              Outer shell: border-radius + overflow-hidden clips the scrollable
              region so the WebKit scrollbar thumb does not stick past rounded corners.
              Inner div alone with both rounded-2xl and overflow-y-auto does not clip
              native scrollbars reliably in Chromium/Safari.
            */}
            <div
              className={cn(
                'pointer-events-auto relative flex w-full min-h-0 flex-col outline-none md:mx-auto',
                'md:z-10 md:flex-initial md:max-h-[min(640px,calc(100dvh_-_var(--menu-top-height,65px)_-_2.5rem))] md:max-w-[min(768px,calc(100vw_-_var(--sidebar-left-width,0px)_-_var(--sidebar-right-width,0px)_-_var(--main-column-scrollbar-width,10px)_-_2.5rem))]',
                'max-md:max-h-[calc(100dvh_-_var(--menu-top-height,65px))]',
                'overflow-hidden rounded-2xl md:border md:border-border/90 md:bg-background-2 md:shadow-2xl md:ring-1 md:ring-white/5 dark:md:ring-white/10',
                'max-md:rounded-none max-md:border-0 max-md:bg-background-2 max-md:shadow-none max-md:ring-0',
                className,
              )}
              style={spaceAccentPortalStyle}
              data-space-accent-scope
            >
              <div
                ref={overlayPanelRef}
                className="min-h-0 w-full flex-1 overflow-y-auto narrow-scrollbar"
                id="proposal-overlay-panel"
                role="document"
                tabIndex={-1}
              >
                <div className="p-4 lg:p-7">{children}</div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </AsideOverlayLayoutProvider>
  );
}
