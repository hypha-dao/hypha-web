'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  stopOnboardingSpeech,
  speakOnboardingText,
} from './onboarding-voice-speech';

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

export type VoiceInterviewPhase =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking';

export type VoiceInterviewErrorCode =
  | 'unsupported'
  | 'not-allowed'
  | 'audio-capture'
  | 'network'
  | 'session'
  | 'error';

const AUTO_RESUME_DELAY_MS = 450;
const RECOGNITION_RESTART_DELAY_MS = 180;
const NETWORK_RETRY_DELAY_MS = 900;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function joinWithSingleSpace(a: string, b: string): string {
  const left = a.trimEnd();
  const right = b.trimStart();
  if (!left) return right;
  if (!right) return left;
  return `${left} ${right}`;
}

function isAssistantFailureText(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('error occurred while checking your permissions') ||
    normalized.includes('authentication is required') ||
    normalized.includes('authentication failed') ||
    normalized.includes('must be a space member') ||
    normalized.includes('could not verify your identity') ||
    normalized.includes('hit an issue while starting the response')
  );
}

function resolveSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  return (
    (globalThis as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
      .SpeechRecognition ??
    (
      globalThis as unknown as {
        webkitSpeechRecognition?: SpeechRecognitionCtor;
      }
    ).webkitSpeechRecognition ??
    null
  );
}

function mapSpeechRecognitionError(
  code: string | undefined,
): VoiceInterviewErrorCode {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'not-allowed';
    case 'audio-capture':
      return 'audio-capture';
    case 'network':
      return 'network';
    default:
      return 'error';
  }
}

function isBenignSpeechRecognitionError(code: string | undefined): boolean {
  return code === 'aborted' || code === 'no-speech';
}

async function waitForSpeechOutputToSettle(): Promise<void> {
  if (typeof globalThis.speechSynthesis === 'undefined') return;
  if (!globalThis.speechSynthesis.speaking) return;
  globalThis.speechSynthesis.cancel();
  await delay(120);
}

async function ensureMicrophoneAccess(): Promise<
  { ok: true } | { ok: false; code: VoiceInterviewErrorCode }
> {
  if (typeof window === 'undefined') {
    return { ok: false, code: 'unsupported' };
  }
  if (!window.isSecureContext) {
    return { ok: false, code: 'not-allowed' };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: true };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return { ok: true };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return { ok: false, code: 'not-allowed' };
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { ok: false, code: 'audio-capture' };
    }
    return { ok: false, code: 'error' };
  }
}

type UseOnboardingVoiceInterviewOptions = {
  enabled: boolean;
  isStreaming: boolean;
  lastAssistantText: string;
  locale?: string;
  /** Reset voice session state when the active space route changes. */
  activeSpaceSlug?: string;
  autoResumeListening?: boolean;
  silenceMsBeforeSend?: number;
  onSendTranscript: (text: string) => void | Promise<void>;
};

export function useOnboardingVoiceInterview({
  enabled,
  isStreaming,
  lastAssistantText,
  locale,
  activeSpaceSlug,
  autoResumeListening = true,
  silenceMsBeforeSend = 1400,
  onSendTranscript,
}: UseOnboardingVoiceInterviewOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const cancelSpeechRef = useRef<(() => void) | null>(null);
  const committedRef = useRef('');
  const interimRef = useRef('');
  const lastSpokenAssistantRef = useRef('');
  const wasStreamingRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const phaseRef = useRef<VoiceInterviewPhase>('idle');
  const userInitiatedListeningRef = useRef(false);
  const listeningGenerationRef = useRef(0);
  const noSpeechRetryRef = useRef(0);
  const networkRetryRef = useRef(0);
  const startListeningRef = useRef<
    (options?: { userInitiated?: boolean }) => Promise<void>
  >(() => Promise.resolve());

  const lastActiveSpaceSlugRef = useRef(activeSpaceSlug?.trim() || undefined);

  const [phase, setPhase] = useState<VoiceInterviewPhase>('idle');
  phaseRef.current = phase;
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<VoiceInterviewErrorCode | null>(
    null,
  );

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    listeningGenerationRef.current += 1;
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      }
      recognitionRef.current = null;
    }
    committedRef.current = '';
    interimRef.current = '';
    setLiveTranscript('');
  }, [clearSilenceTimer]);

  const stopSpeaking = useCallback(() => {
    cancelSpeechRef.current?.();
    cancelSpeechRef.current = null;
    stopOnboardingSpeech();
  }, []);

  const flushTranscript = useCallback(async () => {
    clearSilenceTimer();
    const text = joinWithSingleSpace(
      committedRef.current,
      interimRef.current,
    ).trim();
    committedRef.current = '';
    interimRef.current = '';
    setLiveTranscript('');
    stopListening();
    if (!text || sendInFlightRef.current) return;
    sendInFlightRef.current = true;
    setPhase('processing');
    try {
      await onSendTranscript(text);
    } finally {
      sendInFlightRef.current = false;
    }
  }, [clearSilenceTimer, onSendTranscript, stopListening]);

  const scheduleSendAfterSilence = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      void flushTranscript();
    }, silenceMsBeforeSend);
  }, [clearSilenceTimer, flushTranscript, silenceMsBeforeSend]);

  const reportRecognitionFailure = useCallback(
    (code: VoiceInterviewErrorCode, options?: { userInitiated?: boolean }) => {
      if (!options?.userInitiated && !userInitiatedListeningRef.current) {
        setPhase('idle');
        return;
      }
      setVoiceError(code);
      stopListening();
      setPhase('idle');
    },
    [stopListening],
  );

  const startListening = useCallback(
    async (options?: { userInitiated?: boolean }) => {
      if (!enabled || isStreaming || sendInFlightRef.current) return;

      const userInitiated = options?.userInitiated === true;
      if (userInitiated) {
        userInitiatedListeningRef.current = true;
        noSpeechRetryRef.current = 0;
        networkRetryRef.current = 0;
      }

      setVoiceError(null);
      stopSpeaking();
      await waitForSpeechOutputToSettle();

      const SR = resolveSpeechRecognitionCtor();
      if (!SR) {
        reportRecognitionFailure('unsupported', { userInitiated });
        return;
      }

      const micAccess = await ensureMicrophoneAccess();
      if (!micAccess.ok) {
        reportRecognitionFailure(micAccess.code, { userInitiated });
        return;
      }

      stopListening();
      await delay(RECOGNITION_RESTART_DELAY_MS);

      const generation = listeningGenerationRef.current + 1;
      listeningGenerationRef.current = generation;

      committedRef.current = '';
      interimRef.current = '';

      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = locale ?? document.documentElement.lang ?? 'en';
      recognition.onresult = (event) => {
        if (generation !== listeningGenerationRef.current) return;
        // Rebuild from the cumulative results list each event — do not append
        // onto committedRef or prior finals get duplicated on every update.
        let committed = '';
        let interim = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result?.[0]) continue;
          if (result.isFinal) {
            committed = joinWithSingleSpace(
              committed,
              result[0].transcript.trim(),
            );
          } else {
            interim = joinWithSingleSpace(interim, result[0].transcript);
          }
        }
        committedRef.current = committed;
        interimRef.current = interim.trim();
        const preview = joinWithSingleSpace(committed, interimRef.current);
        setLiveTranscript(preview);
        if (committedRef.current.trim() || interimRef.current.trim()) {
          scheduleSendAfterSilence();
        }
      };
      recognition.onerror = (event) => {
        if (generation !== listeningGenerationRef.current) return;
        const code = event.error;
        if (isBenignSpeechRecognitionError(code)) {
          if (code === 'no-speech' && noSpeechRetryRef.current < 1) {
            noSpeechRetryRef.current += 1;
            window.setTimeout(() => {
              void startListeningRef.current({ userInitiated });
            }, 300);
            return;
          }
          if (!userInitiated && !userInitiatedListeningRef.current) {
            setPhase('idle');
            return;
          }
          if (code === 'no-speech') {
            setPhase('idle');
            return;
          }
          return;
        }
        if (code === 'network' && networkRetryRef.current < 1) {
          networkRetryRef.current += 1;
          window.setTimeout(() => {
            void startListeningRef.current({ userInitiated });
          }, NETWORK_RETRY_DELAY_MS);
          return;
        }
        console.warn('[VoiceInterview] speech recognition error', { code });
        reportRecognitionFailure(mapSpeechRecognitionError(code), {
          userInitiated,
        });
      };
      recognition.onend = () => {
        if (generation !== listeningGenerationRef.current) return;
        recognitionRef.current = null;
        if (
          enabled &&
          !isStreaming &&
          !sendInFlightRef.current &&
          (committedRef.current.trim() || interimRef.current.trim())
        ) {
          void flushTranscript();
          return;
        }
        if (phaseRef.current === 'listening') setPhase('idle');
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setPhase('listening');
      } catch (error) {
        recognitionRef.current = null;
        console.warn('[VoiceInterview] speech recognition start failed', error);
        reportRecognitionFailure('unsupported', { userInitiated });
      }
    },
    [
      enabled,
      flushTranscript,
      isStreaming,
      locale,
      reportRecognitionFailure,
      scheduleSendAfterSilence,
      stopListening,
      stopSpeaking,
    ],
  );

  startListeningRef.current = startListening;

  const toggleListening = useCallback(() => {
    if (phase === 'listening') {
      void flushTranscript();
      return;
    }
    void startListening({ userInitiated: true });
  }, [flushTranscript, phase, startListening]);

  useEffect(() => {
    if (!enabled) {
      stopListening();
      stopSpeaking();
      userInitiatedListeningRef.current = false;
      setPhase('idle');
      return;
    }
    void ensureMicrophoneAccess();
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [enabled, stopListening, stopSpeaking]);

  useEffect(() => {
    const next = activeSpaceSlug?.trim() || undefined;
    if (lastActiveSpaceSlugRef.current === next) return;
    lastActiveSpaceSlugRef.current = next;
    lastSpokenAssistantRef.current = '';
    noSpeechRetryRef.current = 0;
    networkRetryRef.current = 0;
    userInitiatedListeningRef.current = false;
    stopListening();
    stopSpeaking();
    setPhase('idle');
    setVoiceError(null);
  }, [activeSpaceSlug, stopListening, stopSpeaking]);

  useEffect(() => {
    if (!enabled) return;
    if (isStreaming) {
      wasStreamingRef.current = true;
      stopListening();
      stopSpeaking();
      setPhase('processing');
      return;
    }
    if (!wasStreamingRef.current) return;
    wasStreamingRef.current = false;

    const spoken = lastAssistantText.trim();
    if (
      !spoken ||
      spoken === lastSpokenAssistantRef.current ||
      isAssistantFailureText(spoken)
    ) {
      setPhase('idle');
      return;
    }
    lastSpokenAssistantRef.current = spoken;
    stopListening();
    setPhase('speaking');
    cancelSpeechRef.current = speakOnboardingText(spoken, {
      lang: locale,
      onEnd: () => {
        cancelSpeechRef.current = null;
        setPhase('idle');
        if (!autoResumeListening || !enabled) return;
        window.setTimeout(() => {
          void startListeningRef.current({ userInitiated: false });
        }, AUTO_RESUME_DELAY_MS);
      },
    });
  }, [
    autoResumeListening,
    enabled,
    isStreaming,
    lastAssistantText,
    locale,
    stopListening,
    stopSpeaking,
  ]);

  return {
    phase,
    liveTranscript,
    voiceError,
    isListening: phase === 'listening',
    startListening,
    stopListening,
    stopSpeaking,
    toggleListening,
  };
}
