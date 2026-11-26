'use client';

import React from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useLocale } from 'next-intl';
import {
  type Coherence,
  isAiOrigin,
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

/**
 * Who the creator slot shows (#2724). The stored origin decides first: an AI path shows the AI
 * label (a relay keeps its source-space label, a job its job label), every other known path
 * shows the person. Only rows written before origin existed (`unknown`, or no origin) fall back
 * to the legacy tag, title and description heuristics.
 */
export function resolveSignalCreatorKind({
  origin,
  description,
  title,
  tags,
}: Pick<SignalCreatorMetaInput, 'origin' | 'description' | 'title' | 'tags'>): {
  kind: SignalCreatorKind;
  relaySourceSpaceSlug: string | null;
} {
  const relaySlug = parseRelaySourceSpaceSlug(description);
  if (origin && origin.kind !== 'unknown') {
    if (!isAiOrigin(origin))
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

  const { kind: creatorKind, relaySourceSpaceSlug } = React.useMemo(
    () => resolveSignalCreatorKind({ origin, description, title, tags }),
    [origin, description, title, tags],
  );

  const { space: relaySourceSpace } = useSpaceBySlug(
    relaySourceSpaceSlug ?? '',
  );

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

    const fromHelper = resolveSignalCreatorDisplayName({
      viewerPersonId: person?.id,
      creatorId,
      viewerName: currentUserName,
      creatorName: resolvedPersonName,
      creatorKind: 'person',
    });
    if (fromHelper !== 'Member') return fromHelper;

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
  ]);

  return {
    creatorDisplayName: creatorDisplayName.trim() || null,
    createdAtRelative,
  };
}
