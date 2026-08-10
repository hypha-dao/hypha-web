'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { usePersonById } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../people/components/person-avatar';

function useAssigneeLabel(
  personId: number,
  unknownLabel: string,
): {
  label: string;
  avatarUrl: string;
} {
  const { person } = usePersonById({ id: personId });
  const label =
    [person?.name, person?.surname].filter(Boolean).join(' ').trim() ||
    person?.nickname?.trim() ||
    unknownLabel;
  return { label, avatarUrl: person?.avatarUrl || '' };
}

/**
 * Effective person ids for the card person slot: assignees when set, otherwise
 * the creator so legacy/unassigned signals still show a name.
 */
export function resolveSignalPersonIds({
  assigneeIds,
  fallbackPersonId,
}: {
  assigneeIds?: number[] | null;
  fallbackPersonId?: number | null;
}): number[] {
  const assignees = (assigneeIds ?? []).filter(
    (id) => Number.isInteger(id) && id > 0,
  );
  if (assignees.length > 0) return assignees;
  if (fallbackPersonId != null && fallbackPersonId > 0) {
    return [fallbackPersonId];
  }
  return [];
}

/**
 * Assignee display for signal boards.
 * - `meta` (default): name only — sits in the person slot under the title.
 * - `full`: avatar + name for denser surfaces that still want a face.
 *
 * Pass `fallbackPersonId` (usually the creator) so cards always have a name
 * when no assignee was stored.
 */
export function SignalAssignee({
  assigneeIds,
  fallbackPersonId,
  className,
  variant = 'meta',
}: {
  assigneeIds?: number[] | null;
  /** Shown when `assigneeIds` is empty — typically the signal creator. */
  fallbackPersonId?: number | null;
  className?: string;
  variant?: 'meta' | 'full';
}) {
  const t = useTranslations('CoherenceTab');
  const ids = resolveSignalPersonIds({ assigneeIds, fallbackPersonId });
  const [primaryId, ...extraIds] = ids;
  if (primaryId == null) return null;

  return (
    <SignalAssigneePrimary
      personId={primaryId}
      extraCount={extraIds.length}
      variant={variant}
      className={className}
      title={t('signalAssignee')}
      unknownLabel={t('signalAssigneeUnknown')}
    />
  );
}

function SignalAssigneePrimary({
  personId,
  extraCount,
  variant,
  className,
  title,
  unknownLabel,
}: {
  personId: number;
  extraCount: number;
  variant: 'meta' | 'full';
  className?: string;
  title: string;
  unknownLabel: string;
}) {
  const { label, avatarUrl } = useAssigneeLabel(personId, unknownLabel);

  if (variant === 'full') {
    return (
      <span
        className={cn(
          'inline-flex min-w-0 items-center gap-1.5 text-1 text-muted-foreground',
          className,
        )}
        title={title}
      >
        <PersonAvatar
          size="sm"
          avatarSrc={avatarUrl}
          userName={label}
          className="shrink-0"
        />
        <span className="truncate">{label}</span>
        {extraCount > 0 ? (
          <span className="shrink-0 tabular-nums">+{extraCount}</span>
        ) : null}
      </span>
    );
  }

  return (
    <span
      className={cn('inline-flex min-w-0 max-w-full items-center', className)}
      title={title}
    >
      <span className="truncate">{label}</span>
      {extraCount > 0 ? (
        <span className="ml-0.5 shrink-0 tabular-nums">+{extraCount}</span>
      ) : null}
    </span>
  );
}
