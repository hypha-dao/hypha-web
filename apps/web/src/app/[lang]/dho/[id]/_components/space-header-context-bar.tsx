'use client';

import { cn } from '@hypha-platform/ui-utils';
import { useLayoutEffect, useRef, type ReactNode } from 'react';

type SpaceHeaderContextBarProps = {
  breadcrumbs: ReactNode;
  trailing?: ReactNode;
};

/**
 * Second sticky row under global MenuTop: breadcrumbs left-aligned with the hero
 * container (`max-w-container-2xl` + `px-5`). Sets `--app-subnav-h` for morph portal offset.
 */
export function SpaceHeaderContextBar({
  breadcrumbs,
  trailing,
}: SpaceHeaderContextBarProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const sync = () => {
      document.documentElement.style.setProperty(
        '--app-subnav-h',
        `${el.offsetHeight}px`,
      );
    };
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    sync();
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--app-subnav-h');
    };
  }, []);

  return (
    <div
      ref={rowRef}
      className={cn(
        'sticky z-[29] shrink-0 border-b border-border bg-background-2',
      )}
      style={{ top: 'var(--app-menu-top-h, 65px)' }}
    >
      <div
        className={cn(
          'mx-auto flex min-h-[2.5rem] max-w-container-2xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2',
        )}
      >
        <nav
          className="min-w-0 flex-1 text-muted-foreground [&_a]:text-foreground [&_a:hover]:text-accent-11"
          aria-label="Breadcrumb"
        >
          {breadcrumbs}
        </nav>
        {trailing ? (
          <div className="flex shrink-0 justify-end">{trailing}</div>
        ) : null}
      </div>
    </div>
  );
}
