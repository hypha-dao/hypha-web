'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AsideOverlayLayoutProvider } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

/** Reference-counted body scroll lock for desktop modal stacks — avoids stomping other overlays. */
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
  className?: string;
};

/**
 * Presentation shell for primary @aside flows (proposals, space settings menus,
 * configure space, etc.).
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
 * **Non-modal** `DialogPrimitive.Root` (`modal={false}`): a *modal* Radix dialog
 * sets `disableOutsidePointerEvents`, which blocks portaled dropdowns. Escape
 * and scrim dismissal are suppressed so close stays on in-app routes; parallel
 * routes cannot use the stock “click outside closes” dialog pattern.
 *
 * Plain scrim + optional body scroll lock: `DialogPrimitive.Overlay` is omitted
 * when `modal=false`, so we render the scrim `div` ourselves.
 *
 * **MenuTop:** scrim/host are clipped to `top: var(--menu-top-height)` and use
 * `z-20` / `z-[21]` so the nav (`z-30`) stays clickable.
 */
export function ProposalOverlayShell({
  children,
  className,
}: ProposalOverlayShellProps) {
  const tModalAside = useTranslations('ModalAside');

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
      <DialogPrimitive.Root modal={false} defaultOpen open>
        <DialogPrimitive.Portal>
          {/* Plain scrim below MenuTop (z-30); starts under --menu-top-height */}
          <div
            className={cn(
              'fixed inset-x-0 bottom-0 z-20 hidden bg-black/50 backdrop-blur-xl supports-[backdrop-filter]:bg-black/40 md:block',
              'top-[var(--menu-top-height,65px)]',
            )}
            aria-hidden
          />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            className={cn(
              'fixed z-[21] outline-none max-md:inset-auto max-md:bottom-0 max-md:top-[var(--menu-top-height,65px)] max-md:right-[var(--sidebar-right-width,0px)] max-md:h-auto max-md:w-full max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:bg-background-2 max-md:shadow-none',
              // Host fills only below MenuTop so the nav strip is never covered.
              'md:inset-x-0 md:bottom-0 md:top-[var(--menu-top-height,65px)] md:flex md:items-center md:justify-center md:overflow-hidden md:bg-transparent md:p-4 md:pt-4',
            )}
          >
            <DialogPrimitive.Title className="sr-only">
              {tModalAside('panelAccessibleName')}
            </DialogPrimitive.Title>
            <div
              className={cn(
                'relative flex w-full min-h-0 flex-col outline-none md:mx-auto md:max-h-[min(720px,calc(100dvh-var(--menu-top-height,65px)-2rem))] md:max-w-[min(896px,calc(100vw-2rem))]',
                'md:z-10 md:flex-initial md:overflow-y-auto md:rounded-2xl md:border md:border-border/90 md:bg-background-2 md:shadow-2xl md:ring-1 md:ring-white/5 dark:md:ring-white/10',
                'max-md:max-h-[calc(100dvh-var(--menu-top-height,65px))] max-md:overflow-y-auto',
                className,
              )}
              id="proposal-overlay-panel"
              role="document"
              tabIndex={-1}
            >
              <div className="p-4 lg:p-7">{children}</div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </AsideOverlayLayoutProvider>
  );
}
