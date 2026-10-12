'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { hasAssigneeAcknowledged } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';

export function SignalOwnerSeen({
  assigneeIds,
  acknowledgements,
  className,
}: {
  assigneeIds?: number[] | null;
  acknowledgements?: Record<string, string> | null;
  className?: string;
}) {
  const t = useTranslations('CoherenceTab');
  const ids = assigneeIds ?? [];
  if (ids.length === 0) return null;
  const seen = hasAssigneeAcknowledged(ids, acknowledgements);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] uppercase tracking-wide',
        seen ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400',
        className,
      )}
      title={seen ? t('signalOwnerSeenHint') : t('signalOwnerUnseenHint')}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          seen ? 'bg-muted-foreground/70' : 'bg-amber-500',
        )}
        aria-hidden
      />
      {seen ? t('signalOwnerSeen') : t('signalOwnerUnseen')}
    </span>
  );
}
