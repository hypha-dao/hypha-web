'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { VoiceSessionContext } from './space-voice-session-context';
import {
  clearRealtimeInputAudioBuffer,
  connectOpenAiRealtimeCall,
  fetchRealtimeVoiceSession,
  isSubstantiveUserTranscript,
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
  speakOnboardingText,
  stopOnboardingSpeech,
} from './onboarding-voice-speech';
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
  onSendTranscript: (
    text: string,
  ) => VoiceTranscriptSendOutcome | Promise<VoiceTranscriptSendOutcome>;
};

function mapSessionErrorToVoiceCode(status: number): VoiceInterviewErrorCode {
  if (status === 401 || status === 403) return 'error';
  if (status === 404 || status === 502 || status === 503) return 'session';
  return 'network';
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
      if (current === 'speaking') return null;
      return 'listening';
    case 'output_audio_buffer.started':
    case 'response.output_audio.delta':
    case 'response.audio.delta':
      return 'speaking';
    case 'output_audio_buffer.stopped':
      return null;
    case 'response.done':
    case 'response.completed':
      return null;
    case 'error':
      return current;
    default:
      return null;
  }
}

function restoreListeningIfConnected(
  connection: RealtimeVoiceConnection | null,
  setPhase: (phase: VoiceInterviewPhase) => void,
) {
  if (connection) {
    setPhase('listening');
  }
}

function restoreMicForListening(connection: RealtimeVoiceConnection | null) {
  clearRealtimeInputAudioBuffer(connection);
  setLocalMicEnabled(connection, true);
}

function muteMicDuringAssistantSpeech(
  connection: RealtimeVoiceConnection | null,
) {
  setLocalMicEnabled(connection, false);
  clearRealtimeInputAudioBuffer(connection);
}

function shouldAcceptUserTranscript(options: {
  phase: VoiceInterviewPhase;
  isChatStreaming: boolean;
  sendInFlight: boolean;
  realtimeSpeakInFlight: boolean;
}): boolean {
  if (options.realtimeSpeakInFlight) return false;
  if (options.isChatStreaming) return false;
  if (options.sendInFlight) return false;
  if (options.phase === 'speaking' || options.phase === 'processing') {
    return false;
  }
  return true;
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
  onSendTranscript,
}: UseOnboardingVoiceRealtimeOptions) {
  const connectionRef = useRef<RealtimeVoiceConnection | null>(null);
  const connectInFlightRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const phaseRef = useRef<VoiceInterviewPhase>('idle');
  const lastActiveSpaceSlugRef = useRef(activeSpaceSlug?.trim() || undefined);
  const lastSpokenAssistantRef = useRef('');
  const wasStreamingRef = useRef(false);
  const cancelSpeechRef = useRef<(() => void) | null>(null);
  const realtimeSpeakInFlightRef = useRef(false);
  const realtimeAudioHeardRef = useRef(false);
  const onFallbackRef = useRef(onFallback);
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
  onSendTranscriptRef.current = onSendTranscript;
  recentTranscriptSummaryRef.current = recentTranscriptSummary;
  isChatStreamingRef.current = isChatStreaming;

  const stopBrowserSpeech = useCallback(() => {
    cancelSpeechRef.current?.();
    cancelSpeechRef.current = null;
    stopOnboardingSpeech();
  }, []);

  const speakWithBrowserFallback = useCallback(
    (speakable: string) => {
      muteMicDuringAssistantSpeech(connectionRef.current);
      setPhase('speaking');
      const cancelSpeech = speakOnboardingText(speakable, {
        lang: locale,
        rate: 1.05,
        onEnd: () => {
          cancelSpeechRef.current = null;
          restoreMicForListening(connectionRef.current);
          setPhase(connectionRef.current ? 'listening' : 'idle');
        },
      });
      if (!cancelSpeech) {
        restoreMicForListening(connectionRef.current);
        setPhase(connectionRef.current ? 'listening' : 'idle');
        return;
      }
      cancelSpeechRef.current = cancelSpeech;
    },
    [locale],
  );

  const speakAssistantReply = useCallback(
    (spoken: string) => {
      if (!spoken || isAssistantFailureText(spoken)) {
        setPhase(connectionRef.current ? 'listening' : 'idle');
        return;
      }

      stopBrowserSpeech();

      const speakable = prepareAssistantTextForSpeech(spoken);
      if (!speakable || spoken === lastSpokenAssistantRef.current) {
        setPhase(connectionRef.current ? 'listening' : 'idle');
        return;
      }

      lastSpokenAssistantRef.current = spoken;
      realtimeAudioHeardRef.current = false;

      const connection = connectionRef.current;
      if (connection && speakAssistantTextViaRealtime(connection, speakable)) {
        muteMicDuringAssistantSpeech(connection);
        realtimeSpeakInFlightRef.current = true;
        setPhase('speaking');
        return;
      }

      speakWithBrowserFallback(speakable);
    },
    [speakWithBrowserFallback, stopBrowserSpeech],
  );

  const sendTranscriptToChat = useCallback(async (text: string) => {
    const normalized = text.trim();
    if (
      !normalized ||
      !isSubstantiveUserTranscript(normalized) ||
      sendInFlightRef.current ||
      isChatStreamingRef.current ||
      phaseRef.current === 'speaking' ||
      realtimeSpeakInFlightRef.current ||
      !shouldAcceptUserTranscript({
        phase: phaseRef.current,
        isChatStreaming: isChatStreamingRef.current,
        sendInFlight: sendInFlightRef.current,
        realtimeSpeakInFlight: realtimeSpeakInFlightRef.current,
      })
    ) {
      clearRealtimeInputAudioBuffer(connectionRef.current);
      restoreListeningIfConnected(connectionRef.current, setPhase);
      return;
    }

    muteMicDuringAssistantSpeech(connectionRef.current);
    sendInFlightRef.current = true;
    setPhase('processing');
    setLiveTranscript(normalized);

    try {
      const outcome = await onSendTranscriptRef.current(normalized);
      if (outcome !== 'sent') {
        setPhase(connectionRef.current ? 'listening' : 'idle');
        if (outcome === 'blocked') {
          setVoiceError('blocked');
        } else if (outcome === 'failed') {
          setVoiceError('error');
        }
      }
    } catch {
      setVoiceError('error');
      setPhase(connectionRef.current ? 'listening' : 'idle');
    } finally {
      sendInFlightRef.current = false;
      setLiveTranscript('');
    }
  }, []);

  const disconnect = useCallback(() => {
    connectInFlightRef.current = false;
    setIsConnecting(false);
    setIsRealtimeConnected(false);
    realtimeSpeakInFlightRef.current = false;
    realtimeAudioHeardRef.current = false;
    stopBrowserSpeech();
    const connection = connectionRef.current;
    connectionRef.current = null;
    if (connection) {
      connection.close();
    }
    releaseWarmMicStream();
    setPhase('idle');
  }, [stopBrowserSpeech]);

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
      }

      const nextPhase = resolveEventPhase(event, phaseRef.current);
      if (nextPhase) {
        setPhase(nextPhase);
      }

      if (
        event.type === 'conversation.item.input_audio_transcription.completed'
      ) {
        const transcript =
          typeof event.transcript === 'string' ? event.transcript.trim() : '';
        if (
          !transcript ||
          !shouldAcceptUserTranscript({
            phase: phaseRef.current,
            isChatStreaming: isChatStreamingRef.current,
            sendInFlight: sendInFlightRef.current,
            realtimeSpeakInFlight: realtimeSpeakInFlightRef.current,
          })
        ) {
          clearRealtimeInputAudioBuffer(connectionRef.current);
          if (!transcript) {
            restoreListeningIfConnected(connectionRef.current, setPhase);
          }
          return;
        }

        void sendTranscriptToChat(transcript).catch(() => {
          setVoiceError('error');
          setPhase(connectionRef.current ? 'listening' : 'idle');
        });
        return;
      }

      if (
        event.type === 'conversation.item.input_audio_transcription.failed' ||
        event.type === 'input_audio_transcription.failed'
      ) {
        restoreListeningIfConnected(connectionRef.current, setPhase);
      }

      if (
        event.type === 'response.done' ||
        event.type === 'response.completed' ||
        event.type === 'response.cancelled'
      ) {
        if (realtimeSpeakInFlightRef.current) {
          const heardAudio = realtimeAudioHeardRef.current;
          realtimeSpeakInFlightRef.current = false;
          realtimeAudioHeardRef.current = false;
          if (connectionRef.current) {
            setRealtimeRemoteAudioMuted(connectionRef.current, true);
          }
          if (!heardAudio) {
            const speakable = prepareAssistantTextForSpeech(
              lastSpokenAssistantRef.current,
            );
            if (speakable) {
              speakWithBrowserFallback(speakable);
            } else {
              restoreMicForListening(connectionRef.current);
              setPhase(connectionRef.current ? 'listening' : 'idle');
            }
          } else {
            restoreMicForListening(connectionRef.current);
            void acquireWarmMicStream();
            setPhase(connectionRef.current ? 'listening' : 'idle');
          }
        }
      }
    },
    [sendTranscriptToChat, speakWithBrowserFallback],
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
        setVoiceError('error');
        setPhase('idle');
        onFallbackRef.current?.();
        return;
      }

      await acquireWarmMicStream();

      const session = await fetchRealtimeVoiceSession({
        authToken: token,
        conversationContext: conversationContext as Record<string, unknown>,
        locale,
        recentTranscriptSummary: recentTranscriptSummaryRef.current,
      });

      const connection = await connectOpenAiRealtimeCall({
        clientSecret: session.clientSecret,
        onEvent: handleServerEvent,
        onConnectionStateChange: (state) => {
          if (state === 'connected') {
            setIsRealtimeConnected(true);
            restoreMicForListening(connection);
            setPhase('listening');
          }
          if (
            state === 'failed' ||
            state === 'closed' ||
            state === 'disconnected'
          ) {
            setIsRealtimeConnected(false);
            if (connectionRef.current === connection) {
              connectionRef.current = null;
            }
            setPhase('idle');
          }
        },
      });

      connectionRef.current = connection;
      setIsRealtimeConnected(true);
      setPhase('listening');
      console.info('[VoiceRealtime] connected', {
        model: session.model,
        voice: session.voice,
      });
    } catch (error) {
      console.error('[VoiceRealtime] connect failed:', error);
      const status =
        error && typeof error === 'object' && 'status' in error
          ? Number((error as { status: number }).status)
          : 0;
      setVoiceError(status ? mapSessionErrorToVoiceCode(status) : 'network');
      disconnect();
      onFallbackRef.current?.();
    } finally {
      connectInFlightRef.current = false;
      setIsConnecting(false);
    }
  }, [
    conversationContext,
    disconnect,
    getAccessToken,
    handleServerEvent,
    locale,
  ]);

  const stopSpeaking = useCallback(() => {
    connectionRef.current?.sendEvent({ type: 'response.cancel' });
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
  }, [stopBrowserSpeech]);

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
      if (phase === 'speaking') {
        stopSpeaking();
        return;
      }
      connectionRef.current.sendEvent({ type: 'input_audio_buffer.commit' });
      setPhase('processing');
      return;
    }
    void connect();
  }, [connect, phase, stopSpeaking]);

  const connectRef = useRef(connect);
  connectRef.current = connect;

  useEffect(() => {
    if (!enabled) {
      disconnect();
      setLiveTranscript('');
      setVoiceError(null);
      return;
    }
    return () => {
      disconnect();
    };
  }, [disconnect, enabled]);

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
    if (wasStreamingRef.current || sendInFlightRef.current) return;
    if (phaseRef.current !== 'processing') return;
    restoreListeningIfConnected(connectionRef.current, setPhase);
  }, [enabled, isChatStreaming]);

  useEffect(() => {
    if (!enabled || !isChatStreaming) return;
    wasStreamingRef.current = true;
    stopBrowserSpeech();
    connectionRef.current?.sendEvent({ type: 'response.cancel' });
    realtimeSpeakInFlightRef.current = false;
    realtimeAudioHeardRef.current = false;
    muteMicDuringAssistantSpeech(connectionRef.current);
    if (connectionRef.current) {
      setRealtimeRemoteAudioMuted(connectionRef.current, true);
    }
    setPhase('processing');
  }, [enabled, isChatStreaming, stopBrowserSpeech]);

  useEffect(() => {
    if (!enabled || isChatStreaming) return;
    if (!wasStreamingRef.current) return;
    wasStreamingRef.current = false;

    const spoken = lastAssistantText.trim();
    if (!spoken || isAssistantFailureText(spoken)) {
      setPhase(connectionRef.current ? 'listening' : 'idle');
      return;
    }

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
