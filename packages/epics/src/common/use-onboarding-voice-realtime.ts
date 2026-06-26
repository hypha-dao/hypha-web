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
    case 'output_audio_buffer.stopped':
    case 'response.done':
    case 'response.completed':
      return 'listening';
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

/** Speak a filler if MCP/tools run before the model emits text. */
const VOICE_INTERIM_ACK_DELAY_MS = 2000;

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
  const sendInFlightRef = useRef(false);
  const phaseRef = useRef<VoiceInterviewPhase>('idle');
  const lastActiveSpaceSlugRef = useRef(activeSpaceSlug?.trim() || undefined);
  const lastSpokenAssistantRef = useRef('');
  const wasStreamingRef = useRef(false);
  const awaitingAssistantSpeakRef = useRef(false);
  const realtimeAudioHeardRef = useRef(false);
  const cancelSpeechRef = useRef<(() => void) | null>(null);
  const realtimeSpeakInFlightRef = useRef(false);
  const activeRealtimeResponseIdRef = useRef<string | null>(null);
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
    stopOnboardingSpeech();
  }, []);

  const interruptForUserBargeIn = useCallback(() => {
    onStopChatRef.current?.();
    stopBrowserSpeech();
    interimAckSpokenRef.current = false;
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
      clearRealtimeInputAudioBuffer(connectionRef.current);
    }
  }, [stopBrowserSpeech]);

  const speakWithBrowserFallback = useCallback(
    (speakable: string) => {
      setPhase('speaking');
      const cancelSpeech = speakOnboardingText(speakable, {
        lang: locale,
        rate: 1.05,
        onEnd: () => {
          cancelSpeechRef.current = null;
          setPhase(connectionRef.current ? 'listening' : 'idle');
        },
      });
      if (!cancelSpeech) {
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
        })
      ) {
        realtimeSpeakInFlightRef.current = true;
        setPhase('speaking');
        return;
      }

      speakWithBrowserFallback(speakable);
    },
    [speakWithBrowserFallback],
  );

  const sendTranscriptToChat = useCallback(
    async (text: string) => {
      const normalized = text.trim();
      if (!normalized || sendInFlightRef.current) {
        return;
      }

      if (
        shouldBargeInOnUserSpeech(phaseRef.current, {
          isChatStreaming: isChatStreamingRef.current,
          sendInFlight: sendInFlightRef.current,
          realtimeSpeakInFlight: realtimeSpeakInFlightRef.current,
        })
      ) {
        interruptForUserBargeIn();
        lastSpokenAssistantRef.current = '';
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
    [interruptForUserBargeIn],
  );

  const disconnect = useCallback(() => {
    connectInFlightRef.current = false;
    setIsConnecting(false);
    setIsRealtimeConnected(false);
    awaitingAssistantSpeakRef.current = false;
    wasStreamingRef.current = false;
    interimAckSpokenRef.current = false;
    activeRealtimeResponseIdRef.current = null;
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
      if (event.type === 'input_audio_buffer.speech_started') {
        if (
          shouldBargeInOnUserSpeech(phaseRef.current, {
            isChatStreaming: isChatStreamingRef.current,
            sendInFlight: sendInFlightRef.current,
            realtimeSpeakInFlight: realtimeSpeakInFlightRef.current,
          })
        ) {
          interruptForUserBargeIn();
        }
      }

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
        event.type === 'response.completed' ||
        event.type === 'response.cancelled'
      ) {
        if (realtimeSpeakInFlightRef.current) {
          const heardAudio = realtimeAudioHeardRef.current;
          realtimeSpeakInFlightRef.current = false;
          activeRealtimeResponseIdRef.current = null;
          realtimeAudioHeardRef.current = false;
          if (connectionRef.current) {
            setRealtimeRemoteAudioMuted(connectionRef.current, true);
          }
          if (!heardAudio) {
            const spoken = lastAssistantTextRef.current.trim();
            const speakable = prepareAssistantTextForSpeech(spoken);
            if (speakable) {
              speakWithBrowserFallback(speakable);
            }
          } else {
            void acquireWarmMicStream();
          }
        }
      }
    },
    [interruptForUserBargeIn, sendTranscriptToChat, speakWithBrowserFallback],
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
        audioInput: session.audioInput,
        onEvent: handleServerEvent,
        onConnectionStateChange: (state) => {
          if (state === 'connected') {
            setIsRealtimeConnected(true);
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
      const cancelSpeech = speakOnboardingText(pickVoiceInterimAckPhrase(), {
        lang: locale,
      });
      if (cancelSpeech) {
        cancelSpeechRef.current = cancelSpeech;
        setPhase('processing');
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
