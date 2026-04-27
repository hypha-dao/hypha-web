'use client';

import { useMemo } from 'react';
import {
  useUserPrivyIdByMatrixId,
  usePersonBySub,
} from '@hypha-platform/core/client';

/** Minimal fields for Matrix→Person resolution (matches mention picker rows). */
export type MentionPickCandidate = {
  userId: string;
  displayLabel: string;
  privySub?: string;
};

function formatHyphaPersonName(p: {
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
}): string {
  const full = [p.name, p.surname].filter(Boolean).join(' ').trim();
  if (full) return full;
  return p.nickname?.trim() ?? '';
}

/**
 * Same resolution as {@link HumanChatMentionCandidateRow}: Matrix → Privy link → Person profile,
 * else Matrix fallback label (may be shortened MXID for bridged users).
 */
export function useResolvedMentionCandidateLabel(
  candidate: MentionPickCandidate | null,
): {
  resolvedLabel: string;
  busy: boolean;
  avatarUrl?: string;
  /** Same as original row: block pick until Matrix→Privy link resolves when no roster sub. */
  pickDisabled: boolean;
} {
  const matrixUserId = candidate?.userId ?? '';
  const matrixFallbackLabel = candidate?.displayLabel ?? '';
  const privySub = candidate?.privySub;

  const { privyUserId: linkedSub, isLoading: loadingLink } =
    useUserPrivyIdByMatrixId({
      matrixUserId: privySub || !matrixUserId ? undefined : matrixUserId,
    });
  const resolvedSub = privySub ?? linkedSub;
  const { person, isLoading: loadingPerson } = usePersonBySub({
    sub: resolvedSub,
  });

  const resolvedLabel = useMemo(() => {
    if (!candidate) return '';
    const fromPerson = person ? formatHyphaPersonName(person) : '';
    return fromPerson || matrixFallbackLabel;
  }, [candidate, person, matrixFallbackLabel]);

  const busy =
    Boolean(candidate) &&
    ((!privySub && loadingLink) || (Boolean(resolvedSub) && loadingPerson));

  const avatarUrl = person?.avatarUrl?.trim() || undefined;
  const pickDisabled = !privySub && loadingLink;

  return { resolvedLabel, busy, avatarUrl, pickDisabled };
}
