'use client';

import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

type NetworkControlStripProps = {
  /** Primary view control (Map / List). */
  viewToggle: ReactNode;
  /** Map-only projection + layers (progressive disclosure). */
  mapChrome?: ReactNode;
  /** Secondary map action (e.g. Add location) — not the page primary CTA. */
  trailing?: ReactNode;
  className?: string;
};

/**
 * Single densified Network control strip.
 * Hierarchy: view → map chrome (overflow OK) → trailing secondary action.
 */
export function NetworkControlStrip({
  viewToggle,
  mapChrome,
  trailing,
  className,
}: NetworkControlStripProps) {
  const t = useTranslations('NetworkMap');

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-row flex-wrap items-center gap-1.5 sm:gap-2',
        className,
      )}
      role="toolbar"
      aria-label={t('controlStripLabel')}
    >
      <div className="shrink-0">{viewToggle}</div>
      {mapChrome ? (
        <div className="flex min-w-0 flex-1 flex-row flex-wrap items-center gap-1.5 sm:gap-2">
          {mapChrome}
        </div>
      ) : (
        <div className="min-w-0 flex-1" />
      )}
      {trailing ? (
        <div className="ml-auto shrink-0 self-start sm:self-auto">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
