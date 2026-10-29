'use client';

import { Badge } from '@hypha-platform/ui';
import type { SpaceContextStatus } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

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

  const colorVariant =
    status === 'ratified'
      ? 'success'
      : status === 'proposed'
      ? 'warn'
      : 'neutral';

  return (
    <Badge
      variant="outline"
      colorVariant={colorVariant}
      className="gap-1.5 uppercase tracking-[0.12em]"
    >
      <span
        className={
          status === 'ratified'
            ? 'size-1.5 bg-success-9'
            : status === 'proposed'
            ? 'size-1.5 bg-warning-9'
            : 'size-1.5 bg-neutral-8'
        }
        aria-hidden
      />
      {label}
    </Badge>
  );
}
