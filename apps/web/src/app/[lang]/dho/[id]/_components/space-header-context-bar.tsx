'use client';

import { cn } from '@hypha-platform/ui-utils';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { SPACE_MENU_TOP_FALLBACK_PX } from './space-header-morph-context';

type SpaceHeaderContextBarProps = {
  /** “My Spaces” (small) > [icon] space name — aligned to hero title column */
  identity: ReactNode;
  trailing?: ReactNode;
};

/** Sticky row under MenuTop; sets `--app-subnav-h` for morph / overlap math */
export function SpaceHeaderContextBar({
  identity,
  trailing,
}: SpaceHeaderContextBarProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const tCommon = useTranslations('Common');

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
      style={{
        top: `var(--app-menu-top-h, ${SPACE_MENU_TOP_FALLBACK_PX}px)`,
      }}
    >
      <div
        className={cn(
          'mx-auto flex min-h-[2.25rem] max-w-container-2xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2 sm:py-2.5',
        )}
      >
        <div
          className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5"
          aria-label={tCommon('breadcrumbNavigation')}
        >
          {identity}
        </div>
        {trailing ? (
          <div className="flex shrink-0 justify-end">{trailing}</div>
        ) : null}
      </div>
    </div>
  );
}
