'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { VoiceSessionContext } from './space-voice-session-context';
import {
  connectOpenAiRealtimeCall,
  fetchRealtimeVoiceSession,
  type RealtimeServerEvent,
  type RealtimeVoiceConnection,
} from './onboarding-voice-realtime-client';
import {
  acquireWarmMicStream,
  releaseWarmMicStream,
} from './onboarding-voice-mic';
import {
  estimateSpeechDurationMs,
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

const MIC_PREWARM_BEFORE_TTS_END_MS = 400;

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
  const prelistenTimerRef = useRef<number | null>(null);
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

  const clearPrelistenTimer = useCallback(() => {
    if (prelistenTimerRef.current !== null) {
      window.clearTimeout(prelistenTimerRef.current);
      prelistenTimerRef.current = null;
    }
  }, []);

  const stopBrowserSpeech = useCallback(() => {
    cancelSpeechRef.current?.();
    cancelSpeechRef.current = null;
    stopOnboardingSpeech();
  }, []);

  const sendTranscriptToChat = useCallback(async (text: string) => {
    const normalized = text.trim();
    if (
      !normalized ||
      sendInFlightRef.current ||
      isChatStreamingRef.current ||
      phaseRef.current === 'speaking'
    ) {
      restoreListeningIfConnected(connectionRef.current, setPhase);
      return;
    }

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
    clearPrelistenTimer();
    stopBrowserSpeech();
    const connection = connectionRef.current;
    connectionRef.current = null;
    if (connection) {
      connection.close();
    }
    releaseWarmMicStream();
    setPhase('idle');
  }, [clearPrelistenTimer, stopBrowserSpeech]);

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
    },
    [sendTranscriptToChat],
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
    stopBrowserSpeech();
    clearPrelistenTimer();
    if (connectionRef.current) {
      setPhase('listening');
    } else {
      setPhase('idle');
    }
  }, [clearPrelistenTimer, stopBrowserSpeech]);

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
    clearPrelistenTimer();
    stopBrowserSpeech();
    setPhase('processing');
  }, [clearPrelistenTimer, enabled, isChatStreaming, stopBrowserSpeech]);

  useEffect(() => {
    if (!enabled || isChatStreaming) return;
    if (!wasStreamingRef.current) return;
    wasStreamingRef.current = false;

    const spoken = lastAssistantText.trim();
    if (!spoken || isAssistantFailureText(spoken)) {
      setPhase(connectionRef.current ? 'listening' : 'idle');
      return;
    }

    const speakable = prepareAssistantTextForSpeech(spoken);
    if (!speakable || spoken === lastSpokenAssistantRef.current) {
      setPhase(connectionRef.current ? 'listening' : 'idle');
      return;
    }

    lastSpokenAssistantRef.current = spoken;
    setPhase('speaking');
    clearPrelistenTimer();

    const duration = estimateSpeechDurationMs(speakable);
    prelistenTimerRef.current = window.setTimeout(() => {
      void acquireWarmMicStream();
    }, Math.max(0, duration - MIC_PREWARM_BEFORE_TTS_END_MS));

    const cancelSpeech = speakOnboardingText(speakable, {
      lang: locale,
      rate: 1.05,
      onEnd: () => {
        cancelSpeechRef.current = null;
        clearPrelistenTimer();
        setPhase(connectionRef.current ? 'listening' : 'idle');
      },
    });
    if (!cancelSpeech) {
      clearPrelistenTimer();
      setPhase(connectionRef.current ? 'listening' : 'idle');
      return;
    }
    cancelSpeechRef.current = cancelSpeech;
  }, [
    clearPrelistenTimer,
    enabled,
    isChatStreaming,
    lastAssistantText,
    locale,
  ]);

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
