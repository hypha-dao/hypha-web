'use client';

import {
  looksLikeTechnicalMatrixDisplayName,
  looksLikeTechnicalSpeakerLabel,
  matrixMemberDisplayLabelFromRoom,
  speakerLabelToCanonicalPrivySub,
  useMatrix,
  usePersonBySub,
  useUserPrivyIdByMatrixId,
} from '@hypha-platform/core/client';
import { useMemo } from 'react';

function formatHyphaPersonName(p: {
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
}): string {
  const full = [p.name, p.surname].filter(Boolean).join(' ').trim();
  if (full) return full;
  return p.nickname?.trim() ?? '';
}

function useResolvedCallSpeakerLabel(
  speaker: string,
  roomId: string | null | undefined,
): string {
  const trimmed = speaker.trim();
  const { client } = useMatrix();
  const matrixUserId = trimmed.startsWith('@') ? trimmed : null;
  const privySubFromLabel = speakerLabelToCanonicalPrivySub(trimmed);
  const needsMatrixLink = Boolean(
    matrixUserId &&
      looksLikeTechnicalSpeakerLabel(trimmed) &&
      !privySubFromLabel,
  );

  const syncLabel = useMemo(() => {
    if (!looksLikeTechnicalSpeakerLabel(trimmed)) return trimmed;
    if (matrixUserId) {
      return matrixMemberDisplayLabelFromRoom(
        client,
        roomId ?? null,
        matrixUserId,
      );
    }
    return trimmed;
  }, [client, matrixUserId, roomId, trimmed]);

  const { privyUserId: linkedSub } = useUserPrivyIdByMatrixId({
    matrixUserId: needsMatrixLink ? matrixUserId ?? undefined : undefined,
  });
  const resolvedSub = privySubFromLabel ?? linkedSub;
  const needsPerson = Boolean(
    looksLikeTechnicalSpeakerLabel(trimmed) && resolvedSub,
  );
  const { person } = usePersonBySub({
    sub: needsPerson ? resolvedSub : undefined,
  });

  const personName = person ? formatHyphaPersonName(person) : '';
  if (personName) return personName;
  if (
    matrixUserId &&
    syncLabel &&
    !looksLikeTechnicalMatrixDisplayName(syncLabel, matrixUserId)
  ) {
    return syncLabel;
  }
  if (!looksLikeTechnicalSpeakerLabel(trimmed)) return trimmed;
  return syncLabel || trimmed;
}

function ResolvedCallTranscriptLine({
  line,
  roomId,
}: {
  line: string;
  roomId?: string | null;
}) {
  const colonIdx = line.indexOf(':');
  if (colonIdx <= 0) {
    return <>{line}</>;
  }
  const speaker = line.slice(0, colonIdx).trim();
  const body = line.slice(colonIdx + 1);
  const resolvedSpeaker = useResolvedCallSpeakerLabel(speaker, roomId);
  return (
    <>
      {resolvedSpeaker}:{body}
    </>
  );
}

type ResolvedCallTranscriptExcerptProps = {
  excerpt: string;
  roomId?: string | null;
  className?: string;
};

/**
 * Renders speaker-labeled call transcript text with Hypha member names instead of
 * bridged Privy Matrix locals (`prod_privy_did_privy_*` or `@prod_privy_*:hs`).
 */
export function ResolvedCallTranscriptExcerpt({
  excerpt,
  roomId = null,
  className,
}: ResolvedCallTranscriptExcerptProps) {
  const lines = excerpt.split('\n');
  return (
    <p className={className}>
      {lines.map((line, index) => (
        <span key={`${index}-${line.slice(0, 24)}`}>
          {index > 0 ? '\n' : null}
          <ResolvedCallTranscriptLine line={line} roomId={roomId} />
        </span>
      ))}
    </p>
  );
}
