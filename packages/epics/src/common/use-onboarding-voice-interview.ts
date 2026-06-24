'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  stopOnboardingSpeech,
  speakOnboardingText,
  prepareAssistantTextForSpeech,
  estimateSpeechDurationMs,
} from './onboarding-voice-speech';
import { resolveOnboardingSpeechLocale } from './onboarding-voice-locale';
import {
  acquireWarmMicStream,
  releaseWarmMicStream,
} from './onboarding-voice-mic';

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
  | 'blocked'
  | 'error';

export type VoiceTranscriptSendOutcome =
  | 'sent'
  | 'blocked'
  | 'skipped'
  | 'failed';

const RECOGNITION_RESTART_DELAY_MS = 40;
const NETWORK_RETRY_DELAY_MS = 700;
const MIC_PREWARM_BEFORE_TTS_END_MS = 400;
const DEFAULT_SILENCE_MS_BEFORE_SEND = 850;

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
  const stream = await acquireWarmMicStream();
  if (!stream) {
    return { ok: false, code: 'not-allowed' };
  }
  return { ok: true };
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
  onSendTranscript: (
    text: string,
  ) => VoiceTranscriptSendOutcome | Promise<VoiceTranscriptSendOutcome>;
};

export function useOnboardingVoiceInterview({
  enabled,
  isStreaming,
  lastAssistantText,
  locale,
  activeSpaceSlug,
  autoResumeListening = true,
  silenceMsBeforeSend = DEFAULT_SILENCE_MS_BEFORE_SEND,
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
  const prelistenTimerRef = useRef<number | null>(null);
  const earlySpeechStartedRef = useRef(false);
  const earlySpokenPrefixRef = useRef('');
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

  const clearPrelistenTimer = useCallback(() => {
    if (prelistenTimerRef.current !== null) {
      window.clearTimeout(prelistenTimerRef.current);
      prelistenTimerRef.current = null;
    }
  }, []);

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
    if (!text || sendInFlightRef.current) {
      setPhase('idle');
      return;
    }
    sendInFlightRef.current = true;
    setPhase('processing');
    try {
      const outcome = await onSendTranscript(text);
      if (outcome !== 'sent') {
        setPhase('idle');
        if (outcome === 'blocked') {
          setVoiceError('blocked');
        } else if (outcome === 'failed') {
          setVoiceError('error');
        }
      }
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
      recognition.lang = resolveOnboardingSpeechLocale(locale);
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
      clearPrelistenTimer();
      stopListening();
      stopSpeaking();
      releaseWarmMicStream();
      userInitiatedListeningRef.current = false;
      earlySpeechStartedRef.current = false;
      setPhase('idle');
      return;
    }
    return () => {
      clearPrelistenTimer();
      stopListening();
      stopSpeaking();
      releaseWarmMicStream();
    };
  }, [clearPrelistenTimer, enabled, stopListening, stopSpeaking]);

  useEffect(() => {
    if (!enabled) return;
    void ensureMicrophoneAccess();
    void startListeningRef.current({ userInitiated: true });
  }, [enabled]);

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
    if (!enabled || !isStreaming) return;
    void acquireWarmMicStream();
  }, [enabled, isStreaming]);

  useEffect(() => {
    if (!enabled || !isStreaming) {
      if (!isStreaming) {
        earlySpeechStartedRef.current = false;
        earlySpokenPrefixRef.current = '';
      }
      return;
    }
    if (earlySpeechStartedRef.current) return;

    const speakable = prepareAssistantTextForSpeech(lastAssistantText);
    if (speakable.length < 48) return;

    const firstSentence = speakable.match(/^(.+?[.!?])(?:\s|$)/)?.[1]?.trim();
    if (!firstSentence || firstSentence.length < 20) return;

    earlySpeechStartedRef.current = true;
    earlySpokenPrefixRef.current = firstSentence;
    lastSpokenAssistantRef.current = lastAssistantText.trim();
    clearPrelistenTimer();
    stopListening();
    setPhase('speaking');
    cancelSpeechRef.current?.();
    cancelSpeechRef.current = speakOnboardingText(firstSentence, {
      lang: locale,
      rate: 1.05,
    });
  }, [
    clearPrelistenTimer,
    enabled,
    isStreaming,
    lastAssistantText,
    locale,
    stopListening,
  ]);

  useEffect(() => {
    if (!enabled) return;
    if (isStreaming) {
      wasStreamingRef.current = true;
      clearPrelistenTimer();
      stopListening();
      if (!earlySpeechStartedRef.current) {
        stopSpeaking();
      }
      setPhase('processing');
      return;
    }
  }, [clearPrelistenTimer, enabled, isStreaming, stopListening, stopSpeaking]);

  useEffect(() => {
    if (!enabled || isStreaming) return;
    if (!wasStreamingRef.current) return;
    wasStreamingRef.current = false;

    const spoken = lastAssistantText.trim();
    if (!spoken || isAssistantFailureText(spoken)) {
      earlySpeechStartedRef.current = false;
      earlySpokenPrefixRef.current = '';
      setPhase('idle');
      return;
    }

    const speakable = prepareAssistantTextForSpeech(spoken);
    const earlyPrefix = earlySpokenPrefixRef.current.trim();
    earlySpeechStartedRef.current = false;
    earlySpokenPrefixRef.current = '';

    if (
      earlyPrefix &&
      speakable &&
      speakable.startsWith(earlyPrefix) &&
      speakable.length - earlyPrefix.length < 48
    ) {
      lastSpokenAssistantRef.current = spoken;
      stopSpeaking();
      stopListening();
      setPhase('idle');
      if (!autoResumeListening) return;
      void acquireWarmMicStream().then(() => {
        void startListeningRef.current({ userInitiated: false });
      });
      return;
    }

    if (!speakable || spoken === lastSpokenAssistantRef.current) {
      setPhase('idle');
      if (autoResumeListening) {
        void startListeningRef.current({ userInitiated: false });
      }
      return;
    }

    lastSpokenAssistantRef.current = spoken;
    stopListening();
    setPhase('speaking');
    clearPrelistenTimer();

    const duration = estimateSpeechDurationMs(speakable);
    prelistenTimerRef.current = window.setTimeout(() => {
      void acquireWarmMicStream();
    }, Math.max(0, duration - MIC_PREWARM_BEFORE_TTS_END_MS));

    cancelSpeechRef.current = speakOnboardingText(spoken, {
      lang: locale,
      rate: 1.05,
      onEnd: () => {
        cancelSpeechRef.current = null;
        clearPrelistenTimer();
        setPhase('idle');
        if (!autoResumeListening || !enabled) return;
        void startListeningRef.current({ userInitiated: false });
      },
    });
  }, [
    autoResumeListening,
    clearPrelistenTimer,
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
