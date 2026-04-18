'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { AsideOverlayLayoutProvider } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

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
 * configure space, etc.):
 * — below `md`: matches legacy {@link SidePanel} (docked sheet, respects
 *   --menu-top-height and --sidebar-right-width).
 * — `md` and up: full-viewport overlay with blurred scrim and a centered,
 *   scrollable surface. Stack below Radix portaled UI (`z-50`) and Privy modals.
 */
export function ProposalOverlayShell({
  children,
  className,
}: ProposalOverlayShellProps) {
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
      <div
        className={cn(
          // Below sticky MenuTop (z-30 in root layout) so nav/profile stays clickable.
          // Below Radix portaled layers (z-50). Above normal page content.
          'fixed z-20',
          // Mobile / tablet portrait: docked sheet (same as SidePanel)
          'max-md:bottom-0 max-md:top-[var(--menu-top-height,65px)] max-md:right-[var(--sidebar-right-width,0px)] max-md:w-full max-md:overflow-y-auto max-md:bg-background-2',
          // Desktop: overlay host (content centered; scrim behind)
          'md:inset-0 md:flex md:items-center md:justify-center md:overflow-y-auto md:bg-transparent md:p-4 md:pt-[max(1rem,calc(var(--menu-top-height,65px)+0.5rem))]',
        )}
      >
        <div
          className="absolute inset-0 hidden bg-black/50 backdrop-blur-xl supports-[backdrop-filter]:bg-black/40 md:block"
          aria-hidden
        />
        <div
          className={cn(
            'relative w-full min-h-0',
            // transform establishes a containing block so `position:fixed` LoadingBackdrop anchors to this modal
            // (visible card) instead of the viewport — progress overlay stays centered while scrolling long forms.
            'md:z-10 md:[transform:translateZ(0)] md:max-h-[min(720px,calc(100dvh-var(--menu-top-height,65px)-2rem))] md:w-full md:max-w-[min(896px,calc(100vw-2rem))] md:overflow-y-auto md:rounded-2xl md:border md:border-border md:bg-background-2 md:shadow-xl',
            className,
          )}
        >
          <div className="p-4 lg:p-7">{children}</div>
        </div>
      </div>
    </AsideOverlayLayoutProvider>
  );
}
