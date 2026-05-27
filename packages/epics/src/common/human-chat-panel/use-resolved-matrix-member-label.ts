'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useMemo } from 'react';
import {
  useJwt,
  useMatrix,
  usePersonBySub,
  useUserPrivyIdByMatrixId,
} from '@hypha-platform/core/client';
import {
  looksLikeTechnicalMatrixDisplayName,
  matrixMemberDisplayLabelFromRoom,
  matrixUserIdToCanonicalPrivySub,
  speakerLabelToCanonicalPrivySub,
} from './matrix-room-member-display';

function formatHyphaPersonName(p: {
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
}): string {
  const full = [p.name, p.surname].filter(Boolean).join(' ').trim();
  if (full) return full;
  return p.nickname?.trim() ?? '';
}

type UseResolvedMatrixMemberLabelParams = {
  matrixUserId?: string | null;
  roomId?: string | null;
  fallbackLabel?: string;
  privySub?: string;
};

/**
 * Resolve a Matrix member id (or bridged transcript speaker label) to a Hypha display name.
 * Matches mention picker / call tile resolution: roster canonical sub → Matrix link → Person.
 */
export function useResolvedMatrixMemberLabel({
  matrixUserId,
  roomId = null,
  fallbackLabel = '',
  privySub,
}: UseResolvedMatrixMemberLabelParams): string {
  const trimmedId = matrixUserId?.trim() ?? '';
  const trimmedFallback = fallbackLabel.trim();
  const { client } = useMatrix();

  const syncLabel = useMemo(() => {
    if (!trimmedId) return trimmedFallback;
    if (
      trimmedFallback &&
      !looksLikeTechnicalMatrixDisplayName(trimmedFallback, trimmedId)
    ) {
      return trimmedFallback;
    }
    return matrixMemberDisplayLabelFromRoom(client, roomId, trimmedId);
  }, [client, roomId, trimmedFallback, trimmedId]);

  const canonicalSub =
    (trimmedId ? matrixUserIdToCanonicalPrivySub(trimmedId) : null) ??
    speakerLabelToCanonicalPrivySub(trimmedFallback);
  const needsMatrixLinkLookup = Boolean(
    trimmedId && !privySub && !canonicalSub,
  );

  const { privyUserId: linkedSub } = useUserPrivyIdByMatrixId({
    matrixUserId: needsMatrixLinkLookup ? trimmedId : undefined,
  });
  const resolvedSub = privySub ?? canonicalSub ?? linkedSub;

  const { user } = useAuthentication();
  const { jwt, isLoadingJwt } = useJwt();
  const { person } = usePersonBySub({
    sub: resolvedSub,
  });

  return useMemo(() => {
    const fromPerson = person ? formatHyphaPersonName(person) : '';
    if (fromPerson) return fromPerson;
    if (
      trimmedFallback &&
      trimmedId &&
      !looksLikeTechnicalMatrixDisplayName(trimmedFallback, trimmedId)
    ) {
      return trimmedFallback;
    }
    if (
      syncLabel &&
      trimmedId &&
      !looksLikeTechnicalMatrixDisplayName(syncLabel, trimmedId)
    ) {
      return syncLabel;
    }
    if (
      trimmedFallback &&
      !trimmedId &&
      !looksLikeTechnicalMatrixDisplayName(trimmedFallback, trimmedFallback)
    ) {
      return trimmedFallback;
    }
    if (resolvedSub && user && isLoadingJwt && !jwt) {
      return syncLabel || trimmedFallback;
    }
    return syncLabel || trimmedFallback;
  }, [
    isLoadingJwt,
    jwt,
    person,
    resolvedSub,
    syncLabel,
    trimmedFallback,
    trimmedId,
    user,
  ]);
}
