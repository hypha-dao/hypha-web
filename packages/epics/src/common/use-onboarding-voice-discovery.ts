'use client';

import { useCallback, useMemo } from 'react';

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
  onStopChat?: () => void;
  onSendTranscript: (
    text: string,
  ) => VoiceTranscriptSendOutcome | Promise<VoiceTranscriptSendOutcome>;
  onTranscriptTurn?: (turn: {
    role: 'user' | 'assistant';
    text: string;
  }) => void;
  /** When false, the live session does not hear the member. */
  captureMicrophone?: boolean;
  /** When false, replies stay on the page and are not spoken. */
  speakReplies?: boolean;
};

export function useOnboardingVoiceDiscovery(
  options: UseOnboardingVoiceDiscoveryOptions,
) {
  const realtimeFlagEnabled = getClientEnableOnboardingVoiceRealtime();
  // Browser speech is the robotic voice. A live session is the only voice we use.
  // A failed connection retries; it never drops onto speechSynthesis.
  const handleFallback = useCallback(() => {}, []);

  const useRealtime = Boolean(options.conversationContext);

  const webSpeech = useOnboardingVoiceInterview({
    enabled: false,
    isStreaming: options.isStreaming,
    lastAssistantText: options.lastAssistantText,
    locale: options.locale,
    activeSpaceSlug: options.activeSpaceSlug,
    onSendTranscript: options.onSendTranscript,
  });

  const realtime = useOnboardingVoiceRealtime({
    enabled: options.enabled && useRealtime,
    isChatStreaming: options.isStreaming,
    lastAssistantText: options.lastAssistantText,
    locale: options.locale,
    conversationContext: options.conversationContext,
    recentTranscriptSummary: options.recentTranscriptSummary,
    getAccessToken: options.getAccessToken,
    activeSpaceSlug: options.activeSpaceSlug,
    onFallback: handleFallback,
    onStopChat: options.onStopChat,
    onSendTranscript: options.onSendTranscript,
    captureMicrophone: options.captureMicrophone,
    speakReplies: options.speakReplies,
  });

  const voice = useRealtime ? realtime : webSpeech;

  const voiceErrorMessage = useMemo((): string | null => {
    if (!voice.voiceError) return null;
    return voice.voiceError;
  }, [voice.voiceError]);

  return {
    ...voice,
    userSpeaking: useRealtime ? realtime.userSpeaking : false,
    voiceError: voiceErrorMessage,
    transport: useRealtime ? ('realtime' as const) : ('web_speech' as const),
    realtimeFeatureEnabled: realtimeFlagEnabled,
    isRealtimeConnected:
      useRealtime && 'isRealtimeConnected' in realtime
        ? realtime.isRealtimeConnected
        : false,
    isConnecting:
      useRealtime && 'isConnecting' in realtime ? realtime.isConnecting : false,
    usingWebSpeechFallback: false,
  };
}
