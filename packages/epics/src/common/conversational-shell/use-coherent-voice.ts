'use client';

import * as React from 'react';

import { useOnboardingVoiceRealtime } from '../use-onboarding-voice-realtime';
import { buildCoherentCanvasVoiceSessionContext } from '../space-voice-session-context';
import type {
  VoiceInterviewErrorCode,
  VoiceInterviewPhase,
} from '../use-onboarding-voice-interview';

export interface UseCoherentVoiceOptions {
  /** Master gate — the `enable-coherent-voice` flag AND a host opt-in. */
  enabled: boolean;
  /** Active conversational scope; seeds the interviewer instructions. */
  activeSpaceSlug?: string;
  locale?: string;
  /** Text of the newest assistant message — spoken back via TTS. */
  lastAssistantText?: string;
  /** `/api/chat` is mid-stream — gates barge-in + TTS timing. */
  isChatStreaming?: boolean;
  getAuthToken?: () => Promise<string | null | undefined>;
  /** Abort an in-flight `/api/chat` stream when the member barges in. */
  onStopChat?: () => void;
  /**
   * Runs a confirmed voice transcript as a chat turn (the shell wires this to
   * its normal submit with `voice: true`). Resolve = the turn was sent.
   */
  submitTranscript: (text: string) => void | Promise<void>;
}

export interface CoherentVoiceState {
  /** Voice is usable right now (enabled, supported, not permanently failed). */
  available: boolean;
  phase: VoiceInterviewPhase;
  /** Session open and listening. */
  listening: boolean;
  connecting: boolean;
  error: VoiceInterviewErrorCode | null;
  /** Open the session (or close it if already open). */
  toggle: () => void;
  /** Cut assistant speech (member wants to talk / move on). */
  stopSpeaking: () => void;
}

/**
 * #2486 M8 — voice for the talk-first Coherent entrypoint. A thin wrapper over
 * the (context-agnostic) Realtime voice engine: click-to-toggle opens a
 * hands-free STT+TTS session; a confirmed transcript is run as a normal
 * `conversational_canvas` chat turn and the reply is spoken back. Barge-in and
 * degradation come from the underlying hook. When it can't run (no key, mic
 * denied, WebRTC unsupported) `available` goes false and the text path is
 * untouched.
 */
export function useCoherentVoice({
  enabled,
  activeSpaceSlug,
  locale,
  lastAssistantText,
  isChatStreaming,
  getAuthToken,
  onStopChat,
  submitTranscript,
}: UseCoherentVoiceOptions): CoherentVoiceState {
  const [fellBack, setFellBack] = React.useState(false);

  // A fresh toggle-on should clear a prior soft failure.
  const conversationContext = React.useMemo(
    () =>
      buildCoherentCanvasVoiceSessionContext({
        spaceSlug: activeSpaceSlug,
        locale,
      }),
    [activeSpaceSlug, locale],
  );

  const onSendTranscript = React.useCallback(
    async (text: string): Promise<'sent' | 'failed'> => {
      try {
        await submitTranscript(text);
        return 'sent';
      } catch {
        return 'failed';
      }
    },
    [submitTranscript],
  );

  const onFallback = React.useCallback(() => setFellBack(true), []);

  const {
    phase,
    voiceError,
    isListening,
    isConnecting,
    toggleListening,
    stopSpeaking,
  } = useOnboardingVoiceRealtime({
    enabled: enabled && !fellBack,
    isChatStreaming,
    lastAssistantText,
    locale,
    conversationContext,
    getAccessToken: getAuthToken,
    activeSpaceSlug,
    onFallback,
    onStopChat,
    onSendTranscript,
  });

  const toggle = React.useCallback(() => {
    // Clear a prior soft failure on an explicit retry.
    if (fellBack) setFellBack(false);
    toggleListening();
  }, [fellBack, toggleListening]);

  return {
    available: enabled && !fellBack,
    phase,
    listening: isListening,
    connecting: isConnecting,
    error: voiceError,
    toggle,
    stopSpeaking,
  };
}
