'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AsideOverlayLayoutProvider } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { useSpaceAccentPortalStyles } from '../spaces/components/space-accent-portal-context';

/**
 * Reference-counted body scroll lock for desktop modal stacks.
 * Multiple nested shells / overlays can call `lockBodyScroll` without fighting:
 * only the final `unlock` when the count returns to zero restores
 * `document.body.style.overflow` from `previousBodyOverflow` (including any
 * custom value that existed before the first lock).
 */
let activeDesktopBodyLocks = 0;
let previousBodyOverflow: string | undefined;

const lockBodyScroll = () => {
  if (activeDesktopBodyLocks === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  activeDesktopBodyLocks += 1;
};

const unlockBodyScroll = () => {
  if (activeDesktopBodyLocks === 0) return;

  activeDesktopBodyLocks -= 1;
  if (activeDesktopBodyLocks === 0) {
    document.body.style.overflow = previousBodyOverflow ?? '';
    previousBodyOverflow = undefined;
  }
};

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
 * **Modal** `DialogPrimitive.Root`: focus trapping and background inerting for
 * keyboard and screen-reader users. Escape and scrim dismissal stay suppressed
 * so close remains on in-app routes; MDX toolbar popovers anchor via
 * `RichTextEditor` `overlayContainer` instead of fighting `document.body`.
 *
 * Plain scrim: we still render the scrim `div` ourselves (aligned with MenuTop).
 *
 * **MenuTop:** `layout.tsx` uses `z-30` for the nav strip. Scrim and host sit above it
 * (`z-40` / `z-[41]`) so the overlay dims the full main column including space chrome;
 * side panels use higher z and remain on top where applicable.
 */
export function ProposalOverlayShell({
  children,
  className,
}: ProposalOverlayShellProps) {
  const tModalAside = useTranslations('ModalAside');
  const spaceAccentPortalStyle = useSpaceAccentPortalStyles();

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    let isBodyScrollLocked = false;

    const sync = () => {
      if (mq.matches && !isBodyScrollLocked) {
        lockBodyScroll();
        isBodyScrollLocked = true;
      }

      if (!mq.matches && isBodyScrollLocked) {
        unlockBodyScroll();
        isBodyScrollLocked = false;
      }
    };

    sync();
    mq.addEventListener('change', sync);
    return () => {
      mq.removeEventListener('change', sync);
      if (isBodyScrollLocked) {
        unlockBodyScroll();
      }
    };
  }, []);

  return (
    <AsideOverlayLayoutProvider mode="modal-shell">
      <DialogPrimitive.Root modal open>
        <DialogPrimitive.Portal>
          {/* Plain scrim below MenuTop (z-30); starts under --menu-top-height */}
          <div
            className={cn(
              'fixed bottom-0 z-40 hidden bg-black/45 backdrop-blur-md supports-[backdrop-filter]:bg-black/35 md:block',
              'left-[var(--sidebar-left-width,0px)] right-[var(--sidebar-right-width,0px)]',
              'top-[var(--menu-top-height,65px)]',
            )}
            aria-hidden
          />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            className={cn(
              'fixed z-[41] outline-none max-md:inset-auto max-md:bottom-0 max-md:left-[var(--sidebar-left-width,0px)] max-md:top-[var(--menu-top-height,65px)] max-md:right-[var(--sidebar-right-width,0px)] max-md:h-auto max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:bg-background-2 max-md:shadow-none',
              // Host fills main column from top of viewport; horizontal bounds match inset when panels are open.
              'md:left-[var(--sidebar-left-width,0px)] md:right-[var(--sidebar-right-width,0px)] md:bottom-0 md:top-0 md:flex md:items-center md:justify-center md:overflow-hidden md:bg-transparent md:p-4 md:pt-[max(1rem,var(--menu-top-height,65px))]',
            )}
          >
            <DialogPrimitive.Title className="sr-only">
              {tModalAside('panelAccessibleName')}
            </DialogPrimitive.Title>
            <div
              className={cn(
                'relative flex w-full min-h-0 flex-col outline-none md:mx-auto md:max-h-[min(720px,calc(100dvh_-_var(--menu-top-height,65px)_-_2rem))] md:max-w-[min(896px,calc(100vw_-_var(--sidebar-left-width,0px)_-_var(--sidebar-right-width,0px)_-_2rem))]',
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
