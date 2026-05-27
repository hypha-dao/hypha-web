'use client';

import {
  splitSpeakerLabeledTranscriptLine,
  useMatrix,
} from '@hypha-platform/core/client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useResolvedMatrixMemberLabel } from '../../common/human-chat-panel/use-resolved-matrix-member-label';

const SpeakerLabelContext = createContext<ReadonlyMap<string, string>>(
  new Map(),
);

function CallTranscriptSpeakerResolver({
  speaker,
  roomId,
  onResolved,
}: {
  speaker: string;
  roomId?: string | null;
  onResolved: (speaker: string, label: string) => void;
}) {
  const isMatrixUserId = speaker.startsWith('@');
  const label = useResolvedMatrixMemberLabel({
    matrixUserId: isMatrixUserId ? speaker : undefined,
    roomId,
    fallbackLabel: speaker,
  });

  useEffect(() => {
    onResolved(speaker, label);
  }, [label, onResolved, speaker]);

  return null;
}

function CallTranscriptSpeakerRegistry({
  speakers,
  roomId,
  children,
}: {
  speakers: string[];
  roomId?: string | null;
  children: ReactNode;
}) {
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const onResolved = useCallback((speaker: string, label: string) => {
    setLabels((prev) => {
      if (prev.get(speaker) === label) return prev;
      const next = new Map(prev);
      next.set(speaker, label);
      return next;
    });
  }, []);

  return (
    <SpeakerLabelContext.Provider value={labels}>
      {speakers.map((speaker) => (
        <CallTranscriptSpeakerResolver
          key={speaker}
          speaker={speaker}
          roomId={roomId}
          onResolved={onResolved}
        />
      ))}
      {children}
    </SpeakerLabelContext.Provider>
  );
}

function ResolvedCallTranscriptLine({ line }: { line: string }) {
  const labels = useContext(SpeakerLabelContext);
  const parsed = splitSpeakerLabeledTranscriptLine(line);
  if (!parsed) {
    return <>{line}</>;
  }
  const resolvedSpeaker = labels.get(parsed.speaker) ?? parsed.speaker;
  return (
    <>
      {resolvedSpeaker}:{parsed.body}
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
  useMatrix();
  const lines = useMemo(() => excerpt.split('\n'), [excerpt]);
  const speakers = useMemo(() => {
    const unique = new Set<string>();
    for (const line of lines) {
      const parsed = splitSpeakerLabeledTranscriptLine(line);
      if (parsed) unique.add(parsed.speaker);
    }
    return [...unique];
  }, [lines]);

  return (
    <CallTranscriptSpeakerRegistry speakers={speakers} roomId={roomId}>
      <p className={className}>
        {lines.map((line, index) => (
          <span key={`${index}-${line.slice(0, 24)}`}>
            {index > 0 ? '\n' : null}
            <ResolvedCallTranscriptLine line={line} />
          </span>
        ))}
      </p>
    </CallTranscriptSpeakerRegistry>
  );
}
