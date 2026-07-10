'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { VoiceSessionContext } from './space-voice-session-context';
import {
  cancelActiveRealtimeResponse,
  clearRealtimeInputAudioBuffer,
  clearRealtimeOutputAudioBuffer,
  connectOpenAiRealtimeCall,
  extractRealtimeErrorInfo,
  fetchRealtimeVoiceSession,
  isIgnorableRealtimeError,
  isSubstantiveUserTranscript,
  RealtimeVoiceSessionRequestError,
  setLocalMicEnabled,
  setRealtimeRemoteAudioMuted,
  speakAssistantTextViaRealtime,
  type RealtimeServerEvent,
  type RealtimeVoiceConnection,
} from './onboarding-voice-realtime-client';
import {
  acquireWarmMicStream,
  releaseWarmMicStream,
} from './onboarding-voice-mic';
import {
  prepareAssistantTextForSpeech,
  pickVoiceInterimAckPhrase,
  speakOnboardingText,
  speakOnboardingTextControlled,
  stopOnboardingSpeech,
  type SpeechPlaybackController,
} from './onboarding-voice-speech';
import {
  GRACEFUL_INTERRUPT_MIN_SPEECH_MS,
  MIN_USER_TURN_SPEECH_MS,
  countTranscriptWords,
  hasClearInterruptIntentFromTranscript,
  shouldGracefullyInterruptAssistant,
} from './onboarding-voice-interrupt';
import { resolveOnboardingSpeechLocale } from './onboarding-voice-locale';
import type {
  VoiceInterviewErrorCode,
  VoiceInterviewPhase,
  VoiceTranscriptSendOutcome,
} from './use-onboarding-voice-interview';

type UseOnboardingVoiceRealtimeOptions = {
  enabled: boolean;
  isChatStreaming?: boolean;
  lastAssistantText?: string;
  locale?: string;
  conversationContext?: VoiceSessionContext;
  recentTranscriptSummary?: string;
  getAccessToken?: () => Promise<string | null | undefined>;
  activeSpaceSlug?: string;
  onFallback?: () => void;
  /** Stop an in-flight /api/chat stream so the user can barge in with new speech. */
  onStopChat?: () => void;
  onSendTranscript: (
    text: string,
  ) => VoiceTranscriptSendOutcome | Promise<VoiceTranscriptSendOutcome>;
};

function mapSessionErrorToVoiceCode(status: number): VoiceInterviewErrorCode {
  if (status === 401 || status === 403) return 'error';
  if (status === 404 || status === 502 || status === 503) return 'session';
  return 'network';
}

const MAX_REALTIME_CONNECT_RETRIES = 5;
const REALTIME_CONNECT_RETRY_MS = [400, 800, 1500, 2500, 4000];

function resolveRealtimeConnectFailureStatus(error: unknown): number {
  if (error instanceof RealtimeVoiceSessionRequestError) {
    return error.status;
  }
  if (error && typeof error === 'object' && 'status' in error) {
    return Number((error as { status: number }).status);
  }
  return 0;
}

function isPermanentRealtimeConnectFailure(
  status: number,
  error: unknown,
): boolean {
  if (status === 401 || status === 403 || status === 404) return true;
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('secure context') ||
      message.includes('not supported in this browser') ||
      message.includes('only available in the browser')
    ) {
      return true;
    }
  }
  return false;
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

function resolveEventPhase(
  event: RealtimeServerEvent,
  current: VoiceInterviewPhase,
): VoiceInterviewPhase | null {
  switch (event.type) {
    case 'input_audio_buffer.speech_started':
      return 'listening';
    case 'output_audio_buffer.started':
    case 'response.output_audio.delta':
    case 'response.audio.delta':
      return 'speaking';
    case 'error':
      return current;
    default:
      return null;
  }
}

function shouldBargeInOnUserSpeech(
  phase: VoiceInterviewPhase,
  options: {
    isChatStreaming: boolean;
    sendInFlight: boolean;
    realtimeSpeakInFlight: boolean;
  },
): boolean {
  if (options.realtimeSpeakInFlight || phase === 'speaking') return true;
  if (options.isChatStreaming && !options.sendInFlight) return true;
  return false;
}

function restoreListeningIfConnected(
  connection: RealtimeVoiceConnection | null,
  setPhase: (phase: VoiceInterviewPhase) => void,
) {
  if (connection) {
    setPhase('listening');
  }
}

/** Delay before reopening mic after assistant playback — avoids echo retriggering STT. */
const MIC_UNMUTE_DELAY_MS = 450;

/** Speak a filler if MCP/tools run before the model emits text. */
const VOICE_INTERIM_ACK_DELAY_MS = 2000;

function restoreMicForListening(connection: RealtimeVoiceConnection | null) {
  setLocalMicEnabled(connection, true);
}

function muteMicDuringAssistantSpeech(
  connection: RealtimeVoiceConnection | null,
) {
  setLocalMicEnabled(connection, false);
  clearRealtimeInputAudioBuffer(connection);
}

export function useOnboardingVoiceRealtime({
  enabled,
  isChatStreaming = false,
  lastAssistantText = '',
  locale,
  conversationContext,
  recentTranscriptSummary,
  getAccessToken,
  activeSpaceSlug,
  onFallback,
  onStopChat,
  onSendTranscript,
}: UseOnboardingVoiceRealtimeOptions) {
  const connectionRef = useRef<RealtimeVoiceConnection | null>(null);
  const connectInFlightRef = useRef(false);
  const connectRetryCountRef = useRef(0);
  const connectRetryTimerRef = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const sendInFlightRef = useRef(false);
  const phaseRef = useRef<VoiceInterviewPhase>('idle');
  const lastActiveSpaceSlugRef = useRef(activeSpaceSlug?.trim() || undefined);
  const lastSpokenAssistantRef = useRef('');
  const wasStreamingRef = useRef(false);
  const awaitingAssistantSpeakRef = useRef(false);
  const realtimeAudioHeardRef = useRef(false);
  const cancelSpeechRef = useRef<(() => void) | null>(null);
  const speechPlaybackRef = useRef<SpeechPlaybackController | null>(null);
  const gracefulInterruptPendingRef = useRef(false);
  const interruptSpeechStartedAtRef = useRef<number | null>(null);
  const userTurnSpeechStartedAtRef = useRef<number | null>(null);
  const interruptTimerRef = useRef<number | null>(null);
  const micRestoreTimerRef = useRef<number | null>(null);
  const playbackFallbackTimerRef = useRef<number | null>(null);
  const realtimeSpeakInFlightRef = useRef(false);
  const activeRealtimeResponseIdRef = useRef<string | null>(null);
  const pendingBargeInTranscriptRef = useRef<string | null>(null);
  const interimAckSpokenRef = useRef(false);
  const lastAssistantTextRef = useRef(lastAssistantText);
  lastAssistantTextRef.current = lastAssistantText;
  const onFallbackRef = useRef(onFallback);
  const onStopChatRef = useRef(onStopChat);
  const onSendTranscriptRef = useRef(onSendTranscript);
  const recentTranscriptSummaryRef = useRef(recentTranscriptSummary);
  const isChatStreamingRef = useRef(isChatStreaming);

  const [phase, setPhase] = useState<VoiceInterviewPhase>('idle');
  phaseRef.current = phase;
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<VoiceInterviewErrorCode | null>(
    null,
  );
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  onFallbackRef.current = onFallback;
  onStopChatRef.current = onStopChat;
  onSendTranscriptRef.current = onSendTranscript;
  recentTranscriptSummaryRef.current = recentTranscriptSummary;
  isChatStreamingRef.current = isChatStreaming;

  const stopBrowserSpeech = useCallback(() => {
    cancelSpeechRef.current?.();
    cancelSpeechRef.current = null;
    speechPlaybackRef.current?.cancel();
    speechPlaybackRef.current = null;
    stopOnboardingSpeech();
  }, []);

  const clearInterruptTimer = useCallback(() => {
    if (interruptTimerRef.current !== null) {
      window.clearTimeout(interruptTimerRef.current);
      interruptTimerRef.current = null;
    }
  }, []);

  const clearMicRestoreTimer = useCallback(() => {
    if (micRestoreTimerRef.current !== null) {
      window.clearTimeout(micRestoreTimerRef.current);
      micRestoreTimerRef.current = null;
    }
  }, []);

  const clearPlaybackFallbackTimer = useCallback(() => {
    if (playbackFallbackTimerRef.current !== null) {
      window.clearTimeout(playbackFallbackTimerRef.current);
      playbackFallbackTimerRef.current = null;
    }
  }, []);

  const clearConnectRetryTimer = useCallback(() => {
    if (connectRetryTimerRef.current !== null) {
      window.clearTimeout(connectRetryTimerRef.current);
      connectRetryTimerRef.current = null;
    }
  }, []);

  const scheduleMicRestoreForUserTurn = useCallback(() => {
    clearMicRestoreTimer();
    micRestoreTimerRef.current = window.setTimeout(() => {
      micRestoreTimerRef.current = null;
      restoreMicForListening(connectionRef.current);
      if (connectionRef.current) {
        setPhase('listening');
      }
    }, MIC_UNMUTE_DELAY_MS);
  }, [clearMicRestoreTimer]);

  const finishRealtimeSpeakPlayback = useCallback(() => {
    if (!realtimeSpeakInFlightRef.current) return;
    clearPlaybackFallbackTimer();
    realtimeSpeakInFlightRef.current = false;
    activeRealtimeResponseIdRef.current = null;
    realtimeAudioHeardRef.current = false;
    if (connectionRef.current) {
      setRealtimeRemoteAudioMuted(connectionRef.current, true);
    }
    scheduleMicRestoreForUserTurn();
  }, [clearPlaybackFallbackTimer, scheduleMicRestoreForUserTurn]);

  const schedulePlaybackEndFallback = useCallback(
    (speakable: string) => {
      clearPlaybackFallbackTimer();
      const ms = Math.min(
        120_000,
        Math.max(8_000, speakable.length * 85 + 2_000),
      );
      playbackFallbackTimerRef.current = window.setTimeout(() => {
        playbackFallbackTimerRef.current = null;
        finishRealtimeSpeakPlayback();
      }, ms);
    },
    [clearPlaybackFallbackTimer, finishRealtimeSpeakPlayback],
  );

  const completeUserBargeInInterrupt = useCallback(() => {
    gracefulInterruptPendingRef.current = false;
    clearInterruptTimer();
    interruptSpeechStartedAtRef.current = null;
    clearMicRestoreTimer();
    clearPlaybackFallbackTimer();
    stopBrowserSpeech();
    interimAckSpokenRef.current = false;
    restoreMicForListening(connectionRef.current);
    if (realtimeSpeakInFlightRef.current) {
      const connection = connectionRef.current;
      cancelActiveRealtimeResponse(
        connection,
        activeRealtimeResponseIdRef.current,
      );
      clearRealtimeOutputAudioBuffer(connection);
    }
    activeRealtimeResponseIdRef.current = null;
    realtimeSpeakInFlightRef.current = false;
    realtimeAudioHeardRef.current = false;
    awaitingAssistantSpeakRef.current = false;
    wasStreamingRef.current = false;
    if (connectionRef.current) {
      setRealtimeRemoteAudioMuted(connectionRef.current, true);
    }
  }, [
    clearInterruptTimer,
    clearMicRestoreTimer,
    clearPlaybackFallbackTimer,
    stopBrowserSpeech,
  ]);

  const interruptForUserBargeIn = useCallback(() => {
    onStopChatRef.current?.();
    completeUserBargeInInterrupt();
  }, [completeUserBargeInInterrupt]);

  const beginGracefulUserBargeIn = useCallback(() => {
    onStopChatRef.current?.();
    gracefulInterruptPendingRef.current = true;
    speechPlaybackRef.current?.requestGracefulStop();
    restoreMicForListening(connectionRef.current);
    setPhase('listening');
  }, []);

  const speakWithBrowserFallback = useCallback(
    (speakable: string) => {
      restoreMicForListening(connectionRef.current);
      setPhase('speaking');
      speechPlaybackRef.current?.cancel();
      const controller = speakOnboardingTextControlled(speakable, {
        lang: resolveOnboardingSpeechLocale(locale),
        rate: 1.05,
        onEnd: () => {
          speechPlaybackRef.current = null;
          cancelSpeechRef.current = null;
          if (gracefulInterruptPendingRef.current) {
            completeUserBargeInInterrupt();
            return;
          }
          scheduleMicRestoreForUserTurn();
        },
      });
      if (!controller) {
        scheduleMicRestoreForUserTurn();
        return;
      }
      speechPlaybackRef.current = controller;
      cancelSpeechRef.current = controller.cancel;
    },
    [completeUserBargeInInterrupt, locale, scheduleMicRestoreForUserTurn],
  );

  const speakAssistantReply = useCallback(
    (spoken: string) => {
      if (!spoken || isAssistantFailureText(spoken)) {
        setPhase(connectionRef.current ? 'listening' : 'idle');
        return;
      }

      stopBrowserSpeech();
      interimAckSpokenRef.current = false;

      const speakable = prepareAssistantTextForSpeech(spoken);
      if (!speakable || spoken === lastSpokenAssistantRef.current) {
        setPhase(connectionRef.current ? 'listening' : 'idle');
        return;
      }

      lastSpokenAssistantRef.current = spoken;
      realtimeAudioHeardRef.current = false;

      const connection = connectionRef.current;
      if (
        connection &&
        speakAssistantTextViaRealtime(connection, speakable, {
          activeResponseId: activeRealtimeResponseIdRef.current,
          locale,
        })
      ) {
        restoreMicForListening(connection);
        realtimeSpeakInFlightRef.current = true;
        setPhase('speaking');
        return;
      }

      speakWithBrowserFallback(speakable);
    },
    [locale, speakWithBrowserFallback],
  );

  const sendTranscriptToChat = useCallback(
    async (text: string) => {
      const normalized = text.trim();
      if (!normalized || sendInFlightRef.current) {
        return;
      }

      if (
        Boolean(speechPlaybackRef.current) &&
        phaseRef.current === 'speaking' &&
        !hasClearInterruptIntentFromTranscript(normalized)
      ) {
        return;
      }

      if (!isSubstantiveUserTranscript(normalized)) {
        userTurnSpeechStartedAtRef.current = null;
        restoreMicForListening(connectionRef.current);
        restoreListeningIfConnected(connectionRef.current, setPhase);
        return;
      }

      const speechStartedAt = userTurnSpeechStartedAtRef.current;
      userTurnSpeechStartedAtRef.current = null;
      const speechDurationMs =
        speechStartedAt === null ? null : Date.now() - speechStartedAt;
      if (
        speechDurationMs !== null &&
        speechDurationMs < MIN_USER_TURN_SPEECH_MS &&
        countTranscriptWords(normalized) < 3 &&
        !hasClearInterruptIntentFromTranscript(normalized)
      ) {
        restoreMicForListening(connectionRef.current);
        restoreListeningIfConnected(connectionRef.current, setPhase);
        return;
      }

      if (
        shouldBargeInOnUserSpeech(phaseRef.current, {
          isChatStreaming: isChatStreamingRef.current,
          sendInFlight: sendInFlightRef.current,
          realtimeSpeakInFlight: realtimeSpeakInFlightRef.current,
        })
      ) {
        const useGraceful = shouldGracefullyInterruptAssistant({
          phase: phaseRef.current,
          isChatStreaming: isChatStreamingRef.current,
          sendInFlight: sendInFlightRef.current,
          assistantSpeechActive:
            realtimeSpeakInFlightRef.current ||
            Boolean(speechPlaybackRef.current) ||
            phaseRef.current === 'speaking',
          speechStartedAt: interruptSpeechStartedAtRef.current,
          transcript: normalized,
        });
        if (useGraceful) {
          beginGracefulUserBargeIn();
        } else {
          interruptForUserBargeIn();
        }
        lastSpokenAssistantRef.current = '';
        if (isChatStreamingRef.current) {
          pendingBargeInTranscriptRef.current = normalized;
          interimAckSpokenRef.current = false;
          setPhase('processing');
          setLiveTranscript(normalized);
          return;
        }
      }

      interimAckSpokenRef.current = false;
      sendInFlightRef.current = true;
      setPhase('processing');
      setLiveTranscript(normalized);

      try {
        const outcome = await onSendTranscriptRef.current(normalized);
        if (outcome === 'sent') {
          awaitingAssistantSpeakRef.current = true;
        } else {
          awaitingAssistantSpeakRef.current = false;
          setPhase(connectionRef.current ? 'listening' : 'idle');
          if (outcome === 'blocked') {
            setVoiceError('blocked');
          } else if (outcome === 'failed') {
            setVoiceError('error');
          }
        }
      } catch {
        awaitingAssistantSpeakRef.current = false;
        setVoiceError('error');
        setPhase(connectionRef.current ? 'listening' : 'idle');
      } finally {
        sendInFlightRef.current = false;
        setLiveTranscript('');
      }
    },
    [beginGracefulUserBargeIn, interruptForUserBargeIn],
  );

  const disconnect = useCallback(() => {
    clearConnectRetryTimer();
    connectInFlightRef.current = false;
    setIsConnecting(false);
    setIsRealtimeConnected(false);
    awaitingAssistantSpeakRef.current = false;
    wasStreamingRef.current = false;
    interimAckSpokenRef.current = false;
    pendingBargeInTranscriptRef.current = null;
    activeRealtimeResponseIdRef.current = null;
    realtimeSpeakInFlightRef.current = false;
    realtimeAudioHeardRef.current = false;
    clearMicRestoreTimer();
    clearPlaybackFallbackTimer();
    stopBrowserSpeech();
    const connection = connectionRef.current;
    connectionRef.current = null;
    if (connection) {
      connection.close();
    }
    releaseWarmMicStream();
    setPhase('idle');
  }, [
    clearConnectRetryTimer,
    clearMicRestoreTimer,
    clearPlaybackFallbackTimer,
    stopBrowserSpeech,
  ]);

  const connectRef = useRef<() => Promise<void>>(async () => {});

  const scheduleConnectRetry = useCallback(() => {
    if (!enabledRef.current) {
      connectInFlightRef.current = false;
      setIsConnecting(false);
      return;
    }
    if (connectRetryCountRef.current >= MAX_REALTIME_CONNECT_RETRIES) {
      setVoiceError('session');
      connectInFlightRef.current = false;
      setIsConnecting(false);
      onFallbackRef.current?.();
      return;
    }

    const delay =
      REALTIME_CONNECT_RETRY_MS[connectRetryCountRef.current] ??
      REALTIME_CONNECT_RETRY_MS.at(-1)!;
    connectRetryCountRef.current += 1;
    clearConnectRetryTimer();
    setIsConnecting(true);
    connectRetryTimerRef.current = window.setTimeout(() => {
      connectRetryTimerRef.current = null;
      connectInFlightRef.current = false;
      void connectRef.current();
    }, delay);
  }, [clearConnectRetryTimer]);

  const handleServerEvent = useCallback(
    (event: RealtimeServerEvent) => {
      if (
        event.type === 'output_audio_buffer.started' ||
        event.type === 'response.output_audio.delta' ||
        event.type === 'response.audio.delta'
      ) {
        realtimeAudioHeardRef.current = true;
        if (connectionRef.current) {
          setRealtimeRemoteAudioMuted(connectionRef.current, false);
        }
      }

      if (
        event.type === 'output_audio_buffer.stopped' &&
        connectionRef.current
      ) {
        setRealtimeRemoteAudioMuted(connectionRef.current, true);
        if (gracefulInterruptPendingRef.current) {
          completeUserBargeInInterrupt();
        } else if (realtimeSpeakInFlightRef.current) {
          finishRealtimeSpeakPlayback();
        }
      }

      if (event.type === 'input_audio_buffer.speech_started') {
        const assistantBusy =
          phaseRef.current === 'speaking' ||
          realtimeSpeakInFlightRef.current ||
          Boolean(speechPlaybackRef.current) ||
          (phaseRef.current === 'processing' &&
            isChatStreamingRef.current &&
            !sendInFlightRef.current);
        if (assistantBusy) {
          if (interruptSpeechStartedAtRef.current === null) {
            interruptSpeechStartedAtRef.current = Date.now();
          }
          clearInterruptTimer();
          interruptTimerRef.current = window.setTimeout(() => {
            if (
              shouldGracefullyInterruptAssistant({
                phase: phaseRef.current,
                isChatStreaming: isChatStreamingRef.current,
                sendInFlight: sendInFlightRef.current,
                assistantSpeechActive:
                  realtimeSpeakInFlightRef.current ||
                  Boolean(speechPlaybackRef.current) ||
                  phaseRef.current === 'speaking',
                speechStartedAt: interruptSpeechStartedAtRef.current,
              })
            ) {
              beginGracefulUserBargeIn();
            }
          }, GRACEFUL_INTERRUPT_MIN_SPEECH_MS);
        } else {
          userTurnSpeechStartedAtRef.current = Date.now();
        }
      }

      if (event.type === 'input_audio_buffer.speech_stopped') {
        clearInterruptTimer();
        interruptSpeechStartedAtRef.current = null;
      }

      const nextPhase = resolveEventPhase(event, phaseRef.current);
      if (nextPhase) {
        setPhase(nextPhase);
      }

      if (event.type === 'response.created') {
        const responseId =
          typeof event.response?.id === 'string'
            ? event.response.id.trim()
            : '';
        if (responseId) {
          activeRealtimeResponseIdRef.current = responseId;
        }
      }

      if (event.type === 'error') {
        const errorInfo = extractRealtimeErrorInfo(event);
        if (errorInfo && !isIgnorableRealtimeError(errorInfo)) {
          console.error('[VoiceRealtime] server error:', event);
        }
        if (
          errorInfo &&
          isIgnorableRealtimeError(errorInfo) &&
          realtimeSpeakInFlightRef.current
        ) {
          activeRealtimeResponseIdRef.current = null;
        }
        if (
          errorInfo &&
          !isIgnorableRealtimeError(errorInfo) &&
          realtimeSpeakInFlightRef.current &&
          !realtimeAudioHeardRef.current
        ) {
          realtimeSpeakInFlightRef.current = false;
          activeRealtimeResponseIdRef.current = null;
          const spoken = lastAssistantTextRef.current.trim();
          const speakable = prepareAssistantTextForSpeech(spoken);
          if (speakable) {
            speakWithBrowserFallback(speakable);
          } else {
            setPhase(connectionRef.current ? 'listening' : 'idle');
          }
        }
      }

      if (
        event.type === 'conversation.item.input_audio_transcription.completed'
      ) {
        const transcript =
          typeof event.transcript === 'string' ? event.transcript.trim() : '';
        if (transcript) {
          void sendTranscriptToChat(transcript).catch(() => {
            setVoiceError('error');
            setPhase(connectionRef.current ? 'listening' : 'idle');
          });
        } else {
          restoreListeningIfConnected(connectionRef.current, setPhase);
        }
      }

      if (
        event.type === 'conversation.item.input_audio_transcription.failed' ||
        event.type === 'input_audio_transcription.failed'
      ) {
        restoreListeningIfConnected(connectionRef.current, setPhase);
      }

      if (
        event.type === 'response.done' ||
        event.type === 'response.completed'
      ) {
        if (realtimeSpeakInFlightRef.current) {
          const heardAudio = realtimeAudioHeardRef.current;
          if (!heardAudio) {
            realtimeSpeakInFlightRef.current = false;
            activeRealtimeResponseIdRef.current = null;
            realtimeAudioHeardRef.current = false;
            if (connectionRef.current) {
              setRealtimeRemoteAudioMuted(connectionRef.current, true);
            }
            const spoken = lastAssistantTextRef.current.trim();
            const speakable = prepareAssistantTextForSpeech(spoken);
            if (speakable) {
              speakWithBrowserFallback(speakable);
            } else {
              scheduleMicRestoreForUserTurn();
            }
          } else {
            schedulePlaybackEndFallback(
              prepareAssistantTextForSpeech(lastSpokenAssistantRef.current) ||
                '',
            );
          }
        }
      }

      if (event.type === 'response.cancelled') {
        if (realtimeSpeakInFlightRef.current) {
          clearPlaybackFallbackTimer();
          realtimeSpeakInFlightRef.current = false;
          activeRealtimeResponseIdRef.current = null;
          realtimeAudioHeardRef.current = false;
          if (connectionRef.current) {
            setRealtimeRemoteAudioMuted(connectionRef.current, true);
          }
          scheduleMicRestoreForUserTurn();
        }
      }
    },
    [
      beginGracefulUserBargeIn,
      completeUserBargeInInterrupt,
      finishRealtimeSpeakPlayback,
      scheduleMicRestoreForUserTurn,
      schedulePlaybackEndFallback,
      sendTranscriptToChat,
      speakWithBrowserFallback,
      clearInterruptTimer,
    ],
  );

  const connect = useCallback(async () => {
    if (connectInFlightRef.current || connectionRef.current) return;
    if (!conversationContext) {
      setVoiceError('error');
      return;
    }

    connectInFlightRef.current = true;
    setIsConnecting(true);
    setVoiceError(null);
    setPhase('idle');
    setLiveTranscript('');

    try {
      const token = (await getAccessToken?.())?.trim();
      if (!token) {
        scheduleConnectRetry();
        return;
      }

      connectRetryCountRef.current = 0;

      await acquireWarmMicStream();

      const session = await fetchRealtimeVoiceSession({
        authToken: token,
        conversationContext: conversationContext as Record<string, unknown>,
        locale,
        recentTranscriptSummary: recentTranscriptSummaryRef.current,
      });

      const connection = await connectOpenAiRealtimeCall({
        clientSecret: session.clientSecret,
        audioInput: session.audioInput,
        onEvent: handleServerEvent,
        onConnectionStateChange: (state) => {
          const activeConnection = connectionRef.current;
          if (state === 'connected') {
            if (!activeConnection) return;
            setIsRealtimeConnected(true);
            restoreMicForListening(activeConnection);
            setPhase('listening');
          }
          if (
            state === 'failed' ||
            state === 'closed' ||
            state === 'disconnected'
          ) {
            setIsRealtimeConnected(false);
            if (
              activeConnection &&
              connectionRef.current === activeConnection
            ) {
              connectionRef.current = null;
            }
            setPhase('idle');
          }
        },
      });

      connectionRef.current = connection;
      setIsRealtimeConnected(true);
      restoreMicForListening(connection);
      setPhase('listening');
      connectRetryCountRef.current = 0;
      console.info('[VoiceRealtime] connected', {
        model: session.model,
        voice: session.voice,
      });
    } catch (error) {
      console.error('[VoiceRealtime] connect failed:', error);
      const status = resolveRealtimeConnectFailureStatus(error);
      disconnect();
      if (
        isPermanentRealtimeConnectFailure(status, error) ||
        connectRetryCountRef.current >= MAX_REALTIME_CONNECT_RETRIES
      ) {
        setVoiceError(status ? mapSessionErrorToVoiceCode(status) : 'network');
        onFallbackRef.current?.();
        connectInFlightRef.current = false;
        setIsConnecting(false);
        return;
      }
      setVoiceError(status ? mapSessionErrorToVoiceCode(status) : 'network');
      scheduleConnectRetry();
      return;
    } finally {
      if (!connectRetryTimerRef.current) {
        connectInFlightRef.current = false;
        setIsConnecting(false);
      }
    }
  }, [
    conversationContext,
    disconnect,
    getAccessToken,
    handleServerEvent,
    locale,
    scheduleConnectRetry,
  ]);

  const stopSpeaking = useCallback(() => {
    clearMicRestoreTimer();
    clearPlaybackFallbackTimer();
    if (realtimeSpeakInFlightRef.current) {
      cancelActiveRealtimeResponse(
        connectionRef.current,
        activeRealtimeResponseIdRef.current,
      );
      clearRealtimeOutputAudioBuffer(connectionRef.current);
    }
    activeRealtimeResponseIdRef.current = null;
    realtimeSpeakInFlightRef.current = false;
    realtimeAudioHeardRef.current = false;
    if (connectionRef.current) {
      setRealtimeRemoteAudioMuted(connectionRef.current, true);
    }
    stopBrowserSpeech();
    restoreMicForListening(connectionRef.current);
    if (connectionRef.current) {
      setPhase('listening');
    } else {
      setPhase('idle');
    }
  }, [clearMicRestoreTimer, clearPlaybackFallbackTimer, stopBrowserSpeech]);

  const stopListening = useCallback(() => {
    disconnect();
    setLiveTranscript('');
    setVoiceError(null);
  }, [disconnect]);

  const startListening = useCallback(async () => {
    await connect();
  }, [connect]);

  const toggleListening = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.sendEvent({ type: 'input_audio_buffer.commit' });
      setPhase('processing');
      return;
    }
    void connect();
  }, [connect]);

  connectRef.current = connect;

  useEffect(() => {
    if (!enabled) {
      connectRetryCountRef.current = 0;
      clearConnectRetryTimer();
      disconnect();
      setLiveTranscript('');
      setVoiceError(null);
      return;
    }
    return () => {
      disconnect();
    };
  }, [clearConnectRetryTimer, disconnect, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (connectionRef.current || connectInFlightRef.current) return;
    void connectRef.current();
  }, [enabled]);

  useEffect(() => {
    const next = activeSpaceSlug?.trim() || undefined;
    if (lastActiveSpaceSlugRef.current === next) return;
    lastActiveSpaceSlugRef.current = next;
    lastSpokenAssistantRef.current = '';
    stopListening();
  }, [activeSpaceSlug, stopListening]);

  useEffect(() => {
    if (!enabled || isChatStreaming) return;
    const pending = pendingBargeInTranscriptRef.current?.trim();
    if (!pending) return;
    pendingBargeInTranscriptRef.current = null;
    void sendTranscriptToChat(pending);
  }, [enabled, isChatStreaming, sendTranscriptToChat]);

  useEffect(() => {
    if (!enabled || !isChatStreaming) return;
    wasStreamingRef.current = true;
    stopBrowserSpeech();
    interimAckSpokenRef.current = false;
    if (realtimeSpeakInFlightRef.current) {
      cancelActiveRealtimeResponse(
        connectionRef.current,
        activeRealtimeResponseIdRef.current,
      );
      clearRealtimeOutputAudioBuffer(connectionRef.current);
    }
    activeRealtimeResponseIdRef.current = null;
    realtimeSpeakInFlightRef.current = false;
    realtimeAudioHeardRef.current = false;
    if (connectionRef.current) {
      setRealtimeRemoteAudioMuted(connectionRef.current, true);
    }
    setPhase('processing');
  }, [enabled, isChatStreaming, stopBrowserSpeech]);

  useEffect(() => {
    if (!enabled || !isChatStreaming || !awaitingAssistantSpeakRef.current) {
      return;
    }

    if (prepareAssistantTextForSpeech(lastAssistantText.trim())) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (!isChatStreamingRef.current || !awaitingAssistantSpeakRef.current) {
        return;
      }
      if (interimAckSpokenRef.current || realtimeSpeakInFlightRef.current) {
        return;
      }
      const latest = lastAssistantTextRef.current.trim();
      if (prepareAssistantTextForSpeech(latest)) {
        return;
      }

      interimAckSpokenRef.current = true;
      stopBrowserSpeech();
      muteMicDuringAssistantSpeech(connectionRef.current);
      const cancelSpeech = speakOnboardingText(
        pickVoiceInterimAckPhrase(locale),
        {
          lang: resolveOnboardingSpeechLocale(locale),
          onEnd: () => {
            cancelSpeechRef.current = null;
            restoreMicForListening(connectionRef.current);
          },
        },
      );
      if (cancelSpeech) {
        cancelSpeechRef.current = cancelSpeech;
        setPhase('processing');
      } else {
        restoreMicForListening(connectionRef.current);
      }
    }, VOICE_INTERIM_ACK_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [enabled, isChatStreaming, lastAssistantText, locale, stopBrowserSpeech]);

  useEffect(() => {
    if (!enabled || isChatStreaming) return;
    if (!awaitingAssistantSpeakRef.current && !wasStreamingRef.current) return;

    const spoken = lastAssistantText.trim();
    if (!spoken) return;

    awaitingAssistantSpeakRef.current = false;
    wasStreamingRef.current = false;
    speakAssistantReply(spoken);
  }, [enabled, isChatStreaming, lastAssistantText, speakAssistantReply]);

  return {
    phase,
    liveTranscript,
    voiceError,
    isListening: phase === 'listening' && isRealtimeConnected,
    isRealtimeConnected,
    isConnecting,
    startListening,
    stopListening,
    stopSpeaking,
    toggleListening,
  };
}
