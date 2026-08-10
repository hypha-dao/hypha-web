'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { usePersonById } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../people/components/person-avatar';

function SignalAssigneeAvatarAndName({
  personId,
  unknownLabel,
}: {
  personId: number;
  unknownLabel: string;
}) {
  const { person } = usePersonById({ id: personId });
  const label =
    [person?.name, person?.surname].filter(Boolean).join(' ').trim() ||
    person?.nickname?.trim() ||
    unknownLabel;

  return (
    <>
      <PersonAvatar
        size="sm"
        avatarSrc={person?.avatarUrl || ''}
        userName={label}
        className="shrink-0"
      />
      <span className="truncate">{label}</span>
    </>
  );
}

/**
 * Board-card assignee: avatar plus name of the assigned member, with a `+N`
 * counter for the extra ids older signals may carry.
 */
export function SignalAssignee({
  assigneeIds,
  className,
}: {
  assigneeIds: number[];
  className?: string;
}) {
  const t = useTranslations('CoherenceTab');
  const [primaryId, ...extraIds] = assigneeIds;
  if (primaryId == null) return null;

  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 text-1 text-muted-foreground',
        className,
      )}
      title={t('signalAssignee')}
    >
      <SignalAssigneeAvatarAndName
        personId={primaryId}
        unknownLabel={t('signalAssigneeUnknown')}
      />
      {extraIds.length > 0 ? (
        <span className="shrink-0 tabular-nums">+{extraIds.length}</span>
      ) : null}
    </span>
  );
}
