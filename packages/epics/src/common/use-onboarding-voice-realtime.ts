'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { OnboardingConversationContext } from './ai-onboarding-context';
import {
  connectOpenAiRealtimeCall,
  fetchRealtimeVoiceSession,
  type RealtimeServerEvent,
  type RealtimeVoiceConnection,
} from './onboarding-voice-realtime-client';
import type {
  VoiceInterviewErrorCode,
  VoiceInterviewPhase,
} from './use-onboarding-voice-interview';

type UseOnboardingVoiceRealtimeOptions = {
  enabled: boolean;
  locale?: string;
  conversationContext?: OnboardingConversationContext;
  recentTranscriptSummary?: string;
  getAccessToken?: () => Promise<string | null | undefined>;
  activeSpaceSlug?: string;
  onFallback?: () => void;
  onTranscriptTurn?: (turn: {
    role: 'user' | 'assistant';
    text: string;
  }) => void;
};

function mapSessionErrorToVoiceCode(status: number): VoiceInterviewErrorCode {
  if (status === 401 || status === 403) return 'error';
  if (status === 404 || status === 502 || status === 503) return 'session';
  return 'network';
}

function resolveEventPhase(
  event: RealtimeServerEvent,
  current: VoiceInterviewPhase,
): VoiceInterviewPhase | null {
  switch (event.type) {
    case 'input_audio_buffer.speech_started':
      return 'listening';
    case 'input_audio_buffer.speech_stopped':
      return 'processing';
    case 'response.created':
    case 'response.output_item.added':
      return 'processing';
    case 'output_audio_buffer.started':
    case 'response.audio.delta':
      return 'speaking';
    case 'output_audio_buffer.stopped':
    case 'response.done':
    case 'response.completed':
      return 'idle';
    case 'error':
      return current;
    default:
      return null;
  }
}

export function useOnboardingVoiceRealtime({
  enabled,
  locale,
  conversationContext,
  recentTranscriptSummary,
  getAccessToken,
  activeSpaceSlug,
  onFallback,
  onTranscriptTurn,
}: UseOnboardingVoiceRealtimeOptions) {
  const connectionRef = useRef<RealtimeVoiceConnection | null>(null);
  const connectInFlightRef = useRef(false);
  const phaseRef = useRef<VoiceInterviewPhase>('idle');
  const assistantBufferRef = useRef('');
  const lastActiveSpaceSlugRef = useRef(activeSpaceSlug?.trim() || undefined);
  const onFallbackRef = useRef(onFallback);
  const onTranscriptTurnRef = useRef(onTranscriptTurn);
  const recentTranscriptSummaryRef = useRef(recentTranscriptSummary);

  const [phase, setPhase] = useState<VoiceInterviewPhase>('idle');
  phaseRef.current = phase;
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<VoiceInterviewErrorCode | null>(
    null,
  );
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  onFallbackRef.current = onFallback;
  onTranscriptTurnRef.current = onTranscriptTurn;
  recentTranscriptSummaryRef.current = recentTranscriptSummary;

  const flushPendingAssistantTranscript = useCallback(() => {
    const text = assistantBufferRef.current.trim();
    if (!text) return;
    assistantBufferRef.current = '';
    onTranscriptTurnRef.current?.({ role: 'assistant', text });
  }, []);

  const disconnect = useCallback(() => {
    flushPendingAssistantTranscript();
    connectInFlightRef.current = false;
    setIsConnecting(false);
    setIsRealtimeConnected(false);
    const connection = connectionRef.current;
    connectionRef.current = null;
    if (connection) {
      connection.close();
    }
    setPhase('idle');
  }, [flushPendingAssistantTranscript]);

  const handleServerEvent = useCallback(
    (event: RealtimeServerEvent) => {
      const nextPhase = resolveEventPhase(event, phaseRef.current);
      if (nextPhase) {
        setPhase(nextPhase);
      }

      if (
        event.type === 'conversation.item.input_audio_transcription.completed'
      ) {
        const transcript =
          typeof event.transcript === 'string' ? event.transcript.trim() : '';
        if (transcript) {
          setLiveTranscript(transcript);
          onTranscriptTurnRef.current?.({ role: 'user', text: transcript });
        }
      }

      if (
        event.type === 'response.audio_transcript.done' ||
        event.type === 'response.output_audio_transcript.done'
      ) {
        const transcript =
          typeof event.transcript === 'string'
            ? event.transcript.trim()
            : assistantBufferRef.current.trim();
        assistantBufferRef.current = '';
        if (transcript) {
          onTranscriptTurnRef.current?.({
            role: 'assistant',
            text: transcript,
          });
        }
        setLiveTranscript('');
      }

      if (event.type === 'response.audio_transcript.delta') {
        const delta = typeof event.delta === 'string' ? event.delta : '';
        if (delta) {
          assistantBufferRef.current = `${assistantBufferRef.current}${delta}`;
          setLiveTranscript(assistantBufferRef.current);
        }
      }

      if (
        event.type === 'response.done' ||
        event.type === 'response.completed'
      ) {
        flushPendingAssistantTranscript();
      }
    },
    [flushPendingAssistantTranscript],
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
    setPhase('processing');
    setLiveTranscript('');
    assistantBufferRef.current = '';

    try {
      const token = (await getAccessToken?.())?.trim();
      if (!token) {
        setVoiceError('error');
        onFallbackRef.current?.();
        return;
      }

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
    setPhase('listening');
  }, []);

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
      connectionRef.current.sendEvent({ type: 'response.create' });
      setPhase('processing');
      return;
    }
    void connect();
  }, [connect, phase, stopSpeaking]);

  useEffect(() => {
    if (!enabled) {
      disconnect();
      setLiveTranscript('');
      setVoiceError(null);
    }
    return () => {
      disconnect();
    };
  }, [disconnect, enabled]);

  useEffect(() => {
    const next = activeSpaceSlug?.trim() || undefined;
    if (lastActiveSpaceSlugRef.current === next) return;
    lastActiveSpaceSlugRef.current = next;
    stopListening();
  }, [activeSpaceSlug, stopListening]);

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
