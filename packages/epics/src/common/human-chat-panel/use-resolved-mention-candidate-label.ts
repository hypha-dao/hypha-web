'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useMemo } from 'react';
import {
  useJwt,
  useUserPrivyIdByMatrixId,
  usePersonBySub,
} from '@hypha-platform/core/client';
import {
  looksLikeTechnicalMatrixDisplayName,
  matrixUserIdToCanonicalPrivySub,
} from './matrix-room-member-display';

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
  const canonicalSub = matrixUserId
    ? matrixUserIdToCanonicalPrivySub(matrixUserId)
    : null;
  const needsMatrixLinkLookup = Boolean(
    matrixUserId && !privySub && !canonicalSub,
  );

  const { privyUserId: linkedSub, isLoading: loadingLink } =
    useUserPrivyIdByMatrixId({
      matrixUserId: needsMatrixLinkLookup ? matrixUserId : undefined,
    });
  const resolvedSub = privySub ?? canonicalSub ?? linkedSub;
  const { user } = useAuthentication();
  const { jwt, isLoadingJwt } = useJwt();
  const { person, isLoading: loadingPerson } = usePersonBySub({
    sub: resolvedSub,
  });

  const resolvedLabel = useMemo(() => {
    if (!candidate) return '';
    const fromPerson = person ? formatHyphaPersonName(person) : '';
    if (fromPerson.trim()) return fromPerson;
    const fallback = matrixFallbackLabel.trim();
    if (
      fallback &&
      !looksLikeTechnicalMatrixDisplayName(fallback, matrixUserId)
    ) {
      return fallback;
    }
    return '';
  }, [candidate, matrixFallbackLabel, matrixUserId, person]);

  /**
   * Person fetch needs JWT; `usePersonBySub` is idle until then. Block pick while auth is
   * still resolving JWT (but not forever when logged out — no user to wait for).
   */
  const jwtBlockingForPerson =
    Boolean(resolvedSub) &&
    ((user && isLoadingJwt && !jwt) || (!user && isLoadingJwt));
  /** True while Matrix→Privy link, JWT bootstrap, or Person profile is still loading. */
  const busy =
    Boolean(candidate) &&
    ((needsMatrixLinkLookup && loadingLink) ||
      (Boolean(resolvedSub) && (loadingPerson || jwtBlockingForPerson)));

  const avatarUrl = person?.avatarUrl?.trim() || undefined;

  return {
    resolvedLabel,
    busy,
    avatarUrl,
    /** Block pick until Hypha resolution settles so we never insert shortened MXID by mistake. */
    pickDisabled: busy,
  };
}
