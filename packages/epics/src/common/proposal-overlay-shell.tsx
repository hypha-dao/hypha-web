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
 * `md` and up: centered overlay with Radix **non-modal** Dialog semantics
 * (`modal={false}`) so portaled Dropdown/Popover/Select content (`z-50`) still
 * receives pointer events. A **modal** Radix Dialog sets
 * `disableOutsidePointerEvents` on everything outside the dialog panel, which
 * breaks Radix menus portaled to `document.body`.
 *
 * `DialogPrimitive.Overlay` is not used here: when `modal={false}` Radix omits
 * it; we render an equivalent scrim div. Scroll lock on desktop is handled
 * below so the page does not scroll behind the panel.
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
          {/* Plain scrim — Radix Dialog overlay is not rendered when modal=false */}
          <div
            className={cn(
              'fixed inset-0 z-[40] hidden bg-black/50 backdrop-blur-xl supports-[backdrop-filter]:bg-black/40 md:block',
            )}
            aria-hidden
          />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            className={cn(
              'fixed z-[41] outline-none max-md:inset-auto max-md:bottom-0 max-md:top-[var(--menu-top-height,65px)] max-md:right-[var(--sidebar-right-width,0px)] max-md:h-auto max-md:w-full max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:bg-background-2 max-md:shadow-none md:inset-0 md:z-[41] md:flex md:items-center md:justify-center md:overflow-hidden md:bg-transparent md:p-4 md:pt-[max(1rem,calc(var(--menu-top-height,65px)+0.5rem))]',
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
