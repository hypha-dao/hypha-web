'use client';

import type { ReactNode } from 'react';

import { cn } from '@hypha-platform/ui-utils';

type SpaceHeaderHeroFooterRowProps = {
  breadcrumbs: ReactNode;
  trailing: ReactNode;
};

/** Inside hero border-t row: breadcrumbs left | Join + Actions + Space nav right */
export function SpaceHeaderHeroFooterRow({
  breadcrumbs,
  trailing,
}: SpaceHeaderHeroFooterRowProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t border-white/15 pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-5',
      )}
    >
      <div className="min-w-0 flex-1 [&_nav]:text-[11px] [&_nav]:leading-tight [&_ol]:gap-1 [&_a]:text-white/88 [&_a:hover]:text-white [&_svg]:size-3 [&_[data-slot=breadcrumb-separator]]:text-white/40">
        {breadcrumbs}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {trailing}
      </div>
    </div>
  );
}
