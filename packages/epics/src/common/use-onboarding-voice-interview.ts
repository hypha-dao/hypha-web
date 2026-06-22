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
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

export type VoiceInterviewPhase =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking';

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

type UseOnboardingVoiceInterviewOptions = {
  enabled: boolean;
  isStreaming: boolean;
  lastAssistantText: string;
  locale?: string;
  autoResumeListening?: boolean;
  silenceMsBeforeSend?: number;
  onSendTranscript: (text: string) => void | Promise<void>;
};

export function useOnboardingVoiceInterview({
  enabled,
  isStreaming,
  lastAssistantText,
  locale,
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

  const [phase, setPhase] = useState<VoiceInterviewPhase>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
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

  const startListening = useCallback(() => {
    if (!enabled || isStreaming || sendInFlightRef.current) return;
    setVoiceError(null);
    stopSpeaking();

    const SR =
      (globalThis as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ??
      (
        globalThis as unknown as {
          webkitSpeechRecognition?: SpeechRecognitionCtor;
        }
      ).webkitSpeechRecognition;

    if (!SR) {
      setVoiceError('unsupported');
      setPhase('idle');
      return;
    }

    stopListening();
    committedRef.current = '';
    interimRef.current = '';

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = locale ?? document.documentElement.lang ?? 'en';
    recognition.onresult = (event) => {
      let committed = committedRef.current;
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
      if (event.error === 'aborted') return;
      setVoiceError(event.error ?? 'error');
      stopListening();
      setPhase('idle');
    };
    recognition.onend = () => {
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
      if (phase === 'listening') setPhase('idle');
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setPhase('listening');
    } catch {
      recognitionRef.current = null;
      setVoiceError('unsupported');
      setPhase('idle');
    }
  }, [
    enabled,
    flushTranscript,
    isStreaming,
    locale,
    phase,
    scheduleSendAfterSilence,
    stopListening,
    stopSpeaking,
  ]);

  const toggleListening = useCallback(() => {
    if (phase === 'listening') {
      void flushTranscript();
      return;
    }
    startListening();
  }, [flushTranscript, phase, startListening]);

  useEffect(() => {
    if (!enabled) {
      stopListening();
      stopSpeaking();
      setPhase('idle');
      return;
    }
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [enabled, stopListening, stopSpeaking]);

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
      if (autoResumeListening) startListening();
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
        if (autoResumeListening && enabled) startListening();
      },
    });
  }, [
    autoResumeListening,
    enabled,
    isStreaming,
    lastAssistantText,
    locale,
    startListening,
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
