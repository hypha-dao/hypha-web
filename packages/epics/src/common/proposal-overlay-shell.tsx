'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { cn } from '@hypha-platform/ui-utils';

type ProposalOverlayShellProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Presentation shell for proposal flows in the @aside parallel route:
 * — below `md`: matches legacy {@link SidePanel} (docked sheet, respects
 *   --menu-top-height and --sidebar-right-width).
 * — `md` and up: full-viewport overlay with blurred scrim and a centered,
 *   scrollable surface so primary content stays visually focused on desktop.
 */
export function ProposalOverlayShell({
  children,
  className,
}: ProposalOverlayShellProps) {
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => {
      document.body.style.overflow = mq.matches ? 'hidden' : '';
    };
    sync();
    mq.addEventListener('change', sync);
    return () => {
      mq.removeEventListener('change', sync);
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      className={cn(
        'fixed z-[70]',
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
          'md:z-10 md:max-h-[min(720px,calc(100dvh-var(--menu-top-height,65px)-2rem))] md:w-full md:max-w-[min(896px,calc(100vw-2rem))] md:overflow-y-auto md:rounded-2xl md:border md:border-border md:bg-background-2 md:shadow-xl',
          className,
        )}
      >
        <div className="p-4 lg:p-7">{children}</div>
      </div>
    </div>
  );
}
