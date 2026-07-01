'use client';

import React from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useLocale } from 'next-intl';
import {
  type Coherence,
  useMe,
  usePersonById,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';

export type SignalCreatorMetaInput = Pick<
  Coherence,
  'creatorId' | 'createdAt' | 'description' | 'title' | 'tags'
>;

export function useSignalCreatorMeta({
  creatorId,
  createdAt,
  description,
  title,
  tags,
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

  const hasAiSignalTag = React.useMemo(
    () => (tags ?? []).some((tag) => tag.trim().toLowerCase() === 'ai signal'),
    [tags],
  );

  const relaySourceSpaceSlug = React.useMemo(() => {
    const match = description.match(
      /Relayed from ecosystem space:\s*([a-z0-9-]+)/i,
    );
    return match?.[1] ?? null;
  }, [description]);

  const { space: relaySourceSpace } = useSpaceBySlug(
    relaySourceSpaceSlug ?? '',
  );

  const isBackgroundJobSignal = React.useMemo(
    () =>
      /recent space-memory activity indicates a coordination opportunity/i.test(
        description,
      ) || /high-signal .* update/i.test(title),
    [description, title],
  );

  const creatorKind = React.useMemo<
    'person' | 'aiRole' | 'backgroundJob' | 'relay'
  >(() => {
    if (relaySourceSpaceSlug) return 'relay';
    if (isBackgroundJobSignal) return 'backgroundJob';
    if (hasAiSignalTag) return 'aiRole';
    return 'person';
  }, [relaySourceSpaceSlug, isBackgroundJobSignal, hasAiSignalTag]);

  const creatorLabel = React.useMemo(() => {
    if (creatorKind === 'relay') {
      return relaySourceSpace?.title || relaySourceSpaceSlug || 'Relay space';
    }
    if (creatorKind === 'backgroundJob') return 'AI Agent';
    if (creatorKind === 'aiRole') return 'AI Agent';
    return (
      [creatorPerson?.name, creatorPerson?.surname].filter(Boolean).join(' ') ||
      'Member'
    );
  }, [creatorKind, creatorPerson, relaySourceSpace, relaySourceSpaceSlug]);

  const isCreator = person?.id === creatorId;

  const creatorDisplayName = React.useMemo(() => {
    if (isCreator) {
      const currentUserName = [person?.name, person?.surname]
        .filter(Boolean)
        .join(' ')
        .trim();
      return currentUserName || 'You';
    }

    if (creatorKind !== 'person') return creatorLabel;

    const resolvedPersonName = [creatorPerson?.name, creatorPerson?.surname]
      .filter(Boolean)
      .join(' ')
      .trim();
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
    isCreator,
    person?.name,
    person?.surname,
  ]);

  return {
    creatorDisplayName: creatorDisplayName.trim() || null,
    createdAtRelative,
  };
}
