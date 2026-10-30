'use client';

import { Badge } from '@hypha-platform/ui';
import type { SpaceContextStatus } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

const TONE = {
  ratified: {
    colorVariant: 'success',
    className:
      'border-success-11 bg-success-3 text-success-11 hover:bg-success-3',
    dot: 'bg-success-11',
  },
  proposed: {
    colorVariant: 'warn',
    className:
      'border-warning-11 bg-warning-3 text-warning-11 hover:bg-warning-3',
    dot: 'bg-warning-11',
  },
  quiet: {
    colorVariant: 'neutral',
    className:
      'border-neutral-11 bg-neutral-1 text-neutral-11 hover:bg-neutral-1 hover:text-neutral-11',
    dot: 'bg-neutral-11',
  },
} as const;

export function SpaceContextStatusChip({
  status,
}: {
  status: SpaceContextStatus;
}) {
  const t = useTranslations('SpaceContext');
  const label =
    status === 'ratified'
      ? t('status.ratified')
      : status === 'proposed'
      ? t('status.onVoting')
      : status === 'draft'
      ? t('status.draft')
      : t('status.notStarted');
  const tone =
    status === 'ratified' || status === 'proposed' ? TONE[status] : TONE.quiet;

  return (
    <Badge
      variant="surface"
      colorVariant={tone.colorVariant}
      className={`shrink-0 gap-1.5 px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.06em] ${tone.className}`}
    >
      <span className={`size-1.5 ${tone.dot}`} aria-hidden />
      {label}
    </Badge>
  );
}
