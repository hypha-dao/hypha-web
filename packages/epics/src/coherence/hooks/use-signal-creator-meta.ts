'use client';

import React from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';
import {
  type Coherence,
  isAiOrigin,
  isPersistedPersonId,
  type OriginView,
  resolveSignalCreatorDisplayName,
  useMe,
  usePersonById,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';

export type SignalCreatorMetaInput = Pick<
  Coherence,
  'creatorId' | 'createdAt' | 'description' | 'title' | 'tags'
> & { origin?: OriginView | null };

export type SignalCreatorKind = 'person' | 'aiRole' | 'backgroundJob' | 'relay';

function parseRelaySourceSpaceSlug(description: string): string | null {
  const marker = 'Relayed from ecosystem space:';
  const index = description.toLowerCase().indexOf(marker.toLowerCase());
  if (index === -1) return null;
  let rest = description.slice(index + marker.length);
  while (rest.length > 0 && /\s/.test(rest[0] ?? '')) {
    rest = rest.slice(1);
  }
  let slug = '';
  for (const char of rest) {
    if (/[a-z0-9-]/i.test(char)) {
      slug += char.toLowerCase();
      continue;
    }
    break;
  }
  return slug || null;
}

function isHighSignalUpdateTitle(title: string): boolean {
  const lower = title.toLowerCase();
  if (!lower.startsWith('high-signal ')) return false;
  return lower.includes(' update');
}

function isBackgroundJobDescription(description: string): boolean {
  return description
    .toLowerCase()
    .includes(
      'recent space-memory activity indicates a coordination opportunity',
    );
}

/** The ecosystem space a relayed signal came from, for a recorded AI origin or a legacy row. */
export function signalRelaySourceSlug({
  origin,
  description,
}: Pick<SignalCreatorMetaInput, 'origin' | 'description'>): string | null {
  if (origin && origin.kind !== 'unknown' && !isAiOrigin(origin)) return null;
  return parseRelaySourceSpaceSlug(description);
}

/**
 * Who the creator slot shows (#2724). With a recorded origin, the stored person is the creator
 * whatever path wrote the signal: the path is shown apart, as the signal's origin. Only a signal
 * with no person falls back to a label (the AI label, the job label or the relay source). Rows
 * written before origin existed (`unknown`, or no origin) keep the legacy tag, title and
 * description heuristics.
 */
export function resolveSignalCreatorKind({
  origin,
  creatorId,
  description,
  title,
  tags,
}: Pick<SignalCreatorMetaInput, 'origin' | 'description' | 'title' | 'tags'> & {
  creatorId?: number | null;
}): {
  kind: SignalCreatorKind;
  relaySourceSpaceSlug: string | null;
} {
  const relaySlug = parseRelaySourceSpaceSlug(description);
  if (origin && origin.kind !== 'unknown') {
    const hasPerson = typeof creatorId === 'number' && creatorId > 0;
    if (hasPerson || !isAiOrigin(origin))
      return { kind: 'person', relaySourceSpaceSlug: null };
    if (relaySlug) return { kind: 'relay', relaySourceSpaceSlug: relaySlug };
    return {
      kind: origin.kind === 'hypha_intelligence' ? 'backgroundJob' : 'aiRole',
      relaySourceSpaceSlug: null,
    };
  }
  if (relaySlug) return { kind: 'relay', relaySourceSpaceSlug: relaySlug };
  if (
    isBackgroundJobDescription(description) ||
    isHighSignalUpdateTitle(title)
  ) {
    return { kind: 'backgroundJob', relaySourceSpaceSlug: null };
  }
  if ((tags ?? []).some((tag) => tag.trim().toLowerCase() === 'ai signal')) {
    return { kind: 'aiRole', relaySourceSpaceSlug: null };
  }
  return { kind: 'person', relaySourceSpaceSlug: null };
}

export function useSignalCreatorMeta({
  creatorId,
  createdAt,
  description,
  title,
  tags,
  origin,
}: SignalCreatorMetaInput) {
  const locale = useLocale();
  const { person } = useMe();
  const { person: creatorPerson } = usePersonById({ id: creatorId });
  const dateFnsLocale = React.useMemo(
    () => resolveDateFnsLocale(locale),
    [locale],
  );

  const createdAtDate = React.useMemo(() => {
    if (!createdAt) return null;
    const parsed = new Date(createdAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [createdAt]);

  const createdAtRelative = React.useMemo(
    () =>
      createdAtDate
        ? formatDistanceToNowStrict(createdAtDate, {
            addSuffix: true,
            locale: dateFnsLocale,
          })
        : '',
    [createdAtDate, dateFnsLocale],
  );

  const { kind: creatorKind } = React.useMemo(
    () =>
      resolveSignalCreatorKind({ origin, creatorId, description, title, tags }),
    [origin, creatorId, description, title, tags],
  );
  const relaySourceSpaceSlug = React.useMemo(
    () => signalRelaySourceSlug({ origin, description }),
    [origin, description],
  );

  const { space: relaySourceSpace } = useSpaceBySlug(
    relaySourceSpaceSlug ?? '',
  );
  const relaySourceLabel = relaySourceSpaceSlug
    ? relaySourceSpace?.title || relaySourceSpaceSlug
    : null;

  const t = useTranslations('CoherenceTab');

  const creatorLabel = React.useMemo(() => {
    if (creatorKind === 'relay') {
      return (
        relaySourceSpace?.title ||
        relaySourceSpaceSlug ||
        t('signalCreatorRelay')
      );
    }
    if (creatorKind === 'backgroundJob' || creatorKind === 'aiRole') {
      return t('signalCreatorAgent');
    }
    return (
      [creatorPerson?.name, creatorPerson?.surname].filter(Boolean).join(' ') ||
      t('signalCreatorMember')
    );
  }, [creatorKind, creatorPerson, relaySourceSpace, relaySourceSpaceSlug, t]);

  const creatorDisplayName = React.useMemo(() => {
    const currentUserName = [person?.name, person?.surname]
      .filter(Boolean)
      .join(' ')
      .trim();
    const resolvedPersonName = [creatorPerson?.name, creatorPerson?.surname]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (creatorKind !== 'person') {
      return resolveSignalCreatorDisplayName({
        viewerPersonId: person?.id,
        creatorId,
        viewerName: currentUserName,
        creatorName: resolvedPersonName,
        creatorKind,
        nonPersonLabel: creatorLabel,
      });
    }

    const viewerId = person?.id;
    const viewerIsCreator =
      isPersistedPersonId(viewerId) &&
      isPersistedPersonId(creatorId) &&
      viewerId === creatorId;
    if (viewerIsCreator) return currentUserName || t('signalCreatorYou');
    if (resolvedPersonName) return resolvedPersonName;

    const raw = `${creatorId ?? ''}`.trim();
    if (!raw) return creatorLabel;

    if (raw.startsWith('@')) {
      const [localpart] = raw.slice(1).split(':');
      return localpart?.trim() || creatorLabel;
    }

    const [left] = raw.split(':');
    const fallback = left?.trim() || raw;
    if (/^\d+$/.test(fallback)) return creatorLabel;
    return fallback;
  }, [
    creatorId,
    creatorKind,
    creatorLabel,
    creatorPerson?.name,
    creatorPerson?.surname,
    person?.id,
    person?.name,
    person?.surname,
    t,
  ]);

  return {
    creatorDisplayName: creatorDisplayName.trim() || null,
    createdAtRelative,
    /** Display name of the ecosystem space a relayed signal came from, or null. */
    relaySourceLabel,
  };
}
