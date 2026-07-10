'use client';

/** Sustained speech before treating assistant playback as interrupted. */
export const GRACEFUL_INTERRUPT_MIN_SPEECH_MS = 1200;

/** Ignore brief ambient blips (e.g. a fly) unless the transcript is clearly intentional. */
export const MIN_USER_TURN_SPEECH_MS = 550;

const FILLER_TRANSCRIPT =
  /^(?:um+|uh+|ah+|er+|hm+|hmm+|euh+|heu+|ben+|oui+|ok+|okay|yes|yeah|yep|no|non|si|sí|ja|nein|oui oui|d'accord|allô|allo|hello|hi|hey|coucou|bonjour|salut)[\s.!?,-]*$/i;

export function normalizeVoiceTranscript(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function countTranscriptWords(text: string): number {
  const normalized = normalizeVoiceTranscript(text);
  if (!normalized) return 0;
  return normalized.split(/\s+/).filter(Boolean).length;
}

export function isLikelyNoiseTranscript(text: string): boolean {
  const normalized = normalizeVoiceTranscript(text);
  if (!normalized) return true;
  if (normalized.length < 4) return true;
  if (FILLER_TRANSCRIPT.test(normalized)) return true;
  return false;
}

/** User clearly intends to take the floor (not ambient noise or a filler). */
export function hasClearInterruptIntentFromTranscript(text: string): boolean {
  const normalized = normalizeVoiceTranscript(text);
  if (!normalized) return false;
  if (isLikelyNoiseTranscript(normalized)) return false;
  if (countTranscriptWords(normalized) >= 3) return true;
  if (countTranscriptWords(normalized) >= 2 && normalized.length >= 9) {
    return true;
  }
  return normalized.length >= 12;
}

export function hasSustainedInterruptSpeech(
  speechStartedAt: number | null,
  now = Date.now(),
): boolean {
  if (speechStartedAt === null) return false;
  return now - speechStartedAt >= GRACEFUL_INTERRUPT_MIN_SPEECH_MS;
}

export function shouldGracefullyInterruptAssistant(options: {
  phase: 'idle' | 'listening' | 'processing' | 'speaking';
  isChatStreaming: boolean;
  sendInFlight: boolean;
  assistantSpeechActive: boolean;
  speechStartedAt: number | null;
  transcript?: string;
  now?: number;
}): boolean {
  const assistantBusy =
    options.assistantSpeechActive ||
    options.phase === 'speaking' ||
    (options.phase === 'processing' &&
      options.isChatStreaming &&
      !options.sendInFlight);

  if (!assistantBusy) return false;

  const transcript = options.transcript?.trim();
  if (transcript && hasClearInterruptIntentFromTranscript(transcript)) {
    return true;
  }

  return hasSustainedInterruptSpeech(
    options.speechStartedAt,
    options.now ?? Date.now(),
  );
}
