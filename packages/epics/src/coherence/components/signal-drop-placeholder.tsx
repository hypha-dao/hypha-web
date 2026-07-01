'use client';

import React from 'react';
import { Coherence } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { priorityAccentClass } from '../utils/signal-priority-styles';

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
        'relative overflow-hidden rounded-xl border-2 border-dashed border-accent-9/55 bg-accent-2/35 shadow-inner',
        'animate-pulse',
        className,
      )}
      aria-hidden
    >
      <div
        className={cn(
          'absolute inset-y-0 left-0 w-1 rounded-l-xl opacity-70',
          priorityAccentClass(signal.priority),
        )}
      />
      <div className="px-3.5 py-3 pl-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-accent-11">
          {t('signalDropHere')}
        </p>
        <p className="line-clamp-2 text-sm font-medium text-accent-12/90">
          {signal.title}
        </p>
      </div>
    </div>
  );
}
