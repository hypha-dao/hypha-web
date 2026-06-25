'use client';

import { useCallback, useMemo, useState } from 'react';

import type { VoiceSessionContext } from './space-voice-session-context';
import { getClientEnableOnboardingVoiceRealtime } from './onboarding-voice-realtime-flag';
import {
  useOnboardingVoiceInterview,
  type VoiceInterviewErrorCode,
  type VoiceInterviewPhase,
  type VoiceTranscriptSendOutcome,
} from './use-onboarding-voice-interview';
import { useOnboardingVoiceRealtime } from './use-onboarding-voice-realtime';

export type {
  VoiceInterviewErrorCode,
  VoiceInterviewPhase,
  VoiceTranscriptSendOutcome,
};

type UseOnboardingVoiceDiscoveryOptions = {
  enabled: boolean;
  isStreaming: boolean;
  lastAssistantText: string;
  locale?: string;
  activeSpaceSlug?: string;
  conversationContext?: VoiceSessionContext;
  recentTranscriptSummary?: string;
  getAccessToken?: () => Promise<string | null | undefined>;
  onSendTranscript: (
    text: string,
  ) => VoiceTranscriptSendOutcome | Promise<VoiceTranscriptSendOutcome>;
  onTranscriptTurn?: (turn: {
    role: 'user' | 'assistant';
    text: string;
  }) => void;
};

export function useOnboardingVoiceDiscovery(
  options: UseOnboardingVoiceDiscoveryOptions,
) {
  const realtimeFlagEnabled = getClientEnableOnboardingVoiceRealtime();
  const [useWebSpeechFallback, setUseWebSpeechFallback] = useState(false);

  const handleFallback = useCallback(() => {
    setUseWebSpeechFallback(true);
  }, []);

  const useRealtime =
    realtimeFlagEnabled &&
    !useWebSpeechFallback &&
    Boolean(options.conversationContext);

  const webSpeech = useOnboardingVoiceInterview({
    enabled: options.enabled && !useRealtime,
    isStreaming: options.isStreaming,
    lastAssistantText: options.lastAssistantText,
    locale: options.locale,
    activeSpaceSlug: options.activeSpaceSlug,
    onSendTranscript: options.onSendTranscript,
  });

  const realtime = useOnboardingVoiceRealtime({
    enabled: options.enabled && useRealtime,
    isChatStreaming: options.isStreaming,
    locale: options.locale,
    conversationContext: options.conversationContext,
    recentTranscriptSummary: options.recentTranscriptSummary,
    getAccessToken: options.getAccessToken,
    activeSpaceSlug: options.activeSpaceSlug,
    onFallback: handleFallback,
    onTranscriptTurn: options.onTranscriptTurn,
  });

  const voice = useRealtime ? realtime : webSpeech;

  const voiceErrorMessage = useMemo((): string | null => {
    if (!voice.voiceError) return null;
    return voice.voiceError;
  }, [voice.voiceError]);

  return {
    ...voice,
    voiceError: voiceErrorMessage,
    transport: useRealtime ? ('realtime' as const) : ('web_speech' as const),
    realtimeFeatureEnabled: realtimeFlagEnabled,
    isRealtimeConnected:
      useRealtime && 'isRealtimeConnected' in realtime
        ? realtime.isRealtimeConnected
        : false,
    isConnecting:
      useRealtime && 'isConnecting' in realtime ? realtime.isConnecting : false,
    usingWebSpeechFallback: useWebSpeechFallback && realtimeFlagEnabled,
  };
}
