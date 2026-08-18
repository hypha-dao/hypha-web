'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { usePersonById } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../people/components/person-avatar';

/** Avatars shown before the rest collapse into a `+n` counter. */
const DEFAULT_MAX_VISIBLE_ASSIGNEES = 3;

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
 * A single assignee reads as a name; teams collapse to an avatar row capped at
 * `maxVisible` plus a `+n` counter, so cards stay legible however many people
 * are on a signal.
 *
 * Pass `fallbackPersonId` (usually the creator) so cards always have a name
 * when no assignee was stored.
 */
export function SignalAssignee({
  assigneeIds,
  fallbackPersonId,
  className,
  variant = 'meta',
  maxVisible = DEFAULT_MAX_VISIBLE_ASSIGNEES,
}: {
  assigneeIds?: number[] | null;
  /** Shown when `assigneeIds` is empty — typically the signal creator. */
  fallbackPersonId?: number | null;
  className?: string;
  variant?: 'meta' | 'full';
  maxVisible?: number;
}) {
  const t = useTranslations('CoherenceTab');
  const ids = resolveSignalPersonIds({ assigneeIds, fallbackPersonId });
  const [primaryId] = ids;
  if (primaryId == null) return null;

  const title = t('signalAssignee');
  const unknownLabel = t('signalAssigneeUnknown');

  if (ids.length === 1) {
    return (
      <SignalAssigneeSingle
        personId={primaryId}
        variant={variant}
        className={className}
        title={title}
        unknownLabel={unknownLabel}
      />
    );
  }

  const visibleIds = ids.slice(0, Math.max(1, maxVisible));
  const overflowCount = ids.length - visibleIds.length;

  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1 align-middle',
        className,
      )}
      title={t('signalAssigneeCount', { count: ids.length })}
    >
      <span className="inline-flex shrink-0 items-center -space-x-1">
        {visibleIds.map((personId) => (
          <SignalAssigneeAvatar
            key={personId}
            personId={personId}
            variant={variant}
            unknownLabel={unknownLabel}
          />
        ))}
      </span>
      {overflowCount > 0 ? (
        <span className="shrink-0 tabular-nums">+{overflowCount}</span>
      ) : null}
    </span>
  );
}

function SignalAssigneeAvatar({
  personId,
  variant,
  unknownLabel,
}: {
  personId: number;
  variant: 'meta' | 'full';
  unknownLabel: string;
}) {
  const { label, avatarUrl } = useAssigneeLabel(personId, unknownLabel);

  return (
    <span title={label} className="inline-flex">
      <PersonAvatar
        size="sm"
        shape="circle"
        avatarSrc={avatarUrl}
        userName={label}
        className={cn(
          'shrink-0 ring-1 ring-background',
          variant === 'full' ? 'h-5 w-5' : 'h-4 w-4',
        )}
      />
    </span>
  );
}

function SignalAssigneeSingle({
  personId,
  variant,
  className,
  title,
  unknownLabel,
}: {
  personId: number;
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
      </span>
    );
  }

  return (
    <span
      className={cn('inline-flex min-w-0 max-w-full items-center', className)}
      title={title}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}
