'use client';

import { Badge } from '@hypha-platform/ui';
import type {
  SpaceContextPendingChange,
  SpaceContextStatus,
} from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

const TONE = {
  ratified: 'success',
  proposed: 'warn',
  quiet: 'neutral',
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
  const colorVariant =
    status === 'ratified' || status === 'proposed' ? TONE[status] : TONE.quiet;

  return (
    <Badge
      variant="outline"
      colorVariant={colorVariant}
      className="shrink-0 capitalize"
    >
      {label}
    </Badge>
  );
}

/** Suggested addition or removal that applies only once a proposal passes. */
export function SpaceContextChangeBadge({
  change,
}: {
  change: SpaceContextPendingChange | null;
}) {
  const t = useTranslations('SpaceContext');
  if (!change) return null;
  return (
    <Badge
      variant="outline"
      colorVariant="neutral"
      className="craft-chip shrink-0"
    >
      {change === 'add' ? t('change.add') : t('change.remove')}
    </Badge>
  );
}
