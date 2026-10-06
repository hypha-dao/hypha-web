'use client';

import React from 'react';
import { Coherence } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

type SignalDropPlaceholderProps = {
  signal: Coherence;
  className?: string;
};

export function SignalDropPlaceholder({
  signal,
  className,
}: SignalDropPlaceholderProps) {
  const t = useTranslations('CoherenceTab');

  return (
    <div
      className={cn(
        'overflow-hidden rounded-none border border-dashed border-border/70 bg-transparent shadow-none',
        'animate-pulse',
        className,
      )}
      aria-hidden
    >
      <div className="px-3.5 py-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('signalDropHere')}
        </p>
        <p className="line-clamp-2 text-sm font-medium text-foreground">
          {signal.title}
        </p>
      </div>
    </div>
  );
}
