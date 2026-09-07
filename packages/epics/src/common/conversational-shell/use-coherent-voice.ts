'use client';

import * as React from 'react';

import { useOnboardingVoiceRealtime } from '../use-onboarding-voice-realtime';
import { buildCoherentCanvasVoiceSessionContext } from '../space-voice-session-context';
import type {
  VoiceInterviewErrorCode,
  VoiceInterviewPhase,
} from '../use-onboarding-voice-interview';

// #2486 DIAG — trace the voice session lifecycle + every transcript hand-off to
// the chat turn. Off after the M9 gate; flip to `true` to re-enable (M11 voice
// depth will likely want it). The "session ended unexpectedly" warn below stays
// live regardless — it flags a real fault, not a trace.
const DIAG = false;

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
  /**
   * The member has opted the session on. Always `false` on page load / reload —
   * voice is never auto-started. Drives the "tap to enable" affordance vs. the
   * live listening state.
   */
  sessionOn: boolean;
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

  // Click-to-toggle: voice is OFF on every page load / reload. The underlying
  // Realtime engine auto-connects (and prompts for the mic) the moment its
  // `enabled` goes true — right for the onboarding interview page you land on to
  // talk, wrong here, where the mic must be a deliberate opt-in. So the engine
  // is only `enabled` once the member has flipped the session on.
  const [sessionOn, setSessionOn] = React.useState(false);
  const active = enabled && !fellBack && sessionOn;

  // Live view of "a chat turn is streaming" for the transcript guard below.
  const isChatStreamingRef = React.useRef(isChatStreaming);
  isChatStreamingRef.current = isChatStreaming;

  const conversationContext = React.useMemo(
    () =>
      buildCoherentCanvasVoiceSessionContext({
        spaceSlug: activeSpaceSlug,
        locale,
      }),
    [activeSpaceSlug, locale],
  );

  const onSendTranscript = React.useCallback(
    async (text: string): Promise<'sent' | 'failed' | 'skipped'> => {
      if (DIAG) {
        console.log('[coherent][DIAG][voice] transcript → submit', {
          textPreview: text.slice(0, 80),
          length: text.length,
          chatStreaming: isChatStreamingRef.current,
        });
      }
      // Serialize turns: the voice engine clears its own "send in flight" guard
      // as soon as this resolves (which, with the detached submit, is right
      // after dispatch — not when the stream ends). Without this, a fast second
      // utterance opens a *second* concurrent `/api/chat` stream: duplicate
      // messages, duplicate spoken replies, React key collisions. Drop the
      // overlapping utterance (the member can repeat it).
      if (isChatStreamingRef.current) {
        if (DIAG) {
          console.warn(
            '[coherent][DIAG][voice] transcript dropped — a turn is still streaming',
          );
        }
        return 'skipped';
      }
      try {
        await submitTranscript(text);
        if (DIAG) {
          console.log('[coherent][DIAG][voice] transcript submit ok');
        }
        return 'sent';
      } catch (err) {
        if (DIAG) {
          console.log('[coherent][DIAG][voice] transcript submit FAILED', err);
        }
        return 'failed';
      }
    },
    [submitTranscript],
  );

  // A soft fallback (no key, mic denied, WebRTC unsupported, session error)
  // also ends the session so the engine tears down cleanly.
  const onFallback = React.useCallback(() => {
    setFellBack(true);
    setSessionOn(false);
  }, []);

  const { phase, voiceError, isListening, isConnecting, stopSpeaking } =
    useOnboardingVoiceRealtime({
      enabled: active,
      isChatStreaming,
      lastAssistantText,
      locale,
      conversationContext,
      getAccessToken: getAuthToken,
      // NOTE: deliberately NOT forwarding `activeSpaceSlug`. The engine treats a
      // change of `activeSpaceSlug` as "the member navigated to a different space"
      // and tears the session down (`stopListening`). In Coherent the scope moves
      // *within* one conversation on almost every turn (`set_scope`), so that
      // teardown would kill the mic constantly. Scope still reaches the session
      // via `conversationContext` (used at session creation) and every chat turn
      // carries the live scope through `/api/chat`.
      onFallback,
      onStopChat,
      onSendTranscript,
    });

  const toggle = React.useCallback(() => {
    // An explicit toggle clears a prior soft failure and flips the session.
    // `sessionOn` → true lets the engine's own effect connect (mic prompt
    // happens here, on the click); → false lets it disconnect.
    setFellBack(false);
    setSessionOn((v) => {
      if (DIAG) {
        console.log('[coherent][DIAG][voice] toggle', { sessionOn: !v });
      }
      return !v;
    });
  }, []);

  React.useEffect(() => {
    if (!DIAG) return;
    console.log('[coherent][DIAG][voice] state', {
      enabled,
      fellBack,
      sessionOn,
      active,
      phase,
      isListening,
      isConnecting,
      voiceError,
      activeSpaceSlug: activeSpaceSlug ?? null,
    });
  }, [
    enabled,
    fellBack,
    sessionOn,
    active,
    phase,
    isListening,
    isConnecting,
    voiceError,
    activeSpaceSlug,
  ]);

  // Flag an *unexpected* session end: the member still wants voice on
  // (`active`), nothing failed (`voiceError` null), but the engine has gone
  // idle and disconnected. The member did not click to stop — something tore
  // the session down under it (session expiry, a dropped WebRTC connection, a
  // transient engine error). Distinct from the member toggling off.
  const wasLiveRef = React.useRef(false);
  React.useEffect(() => {
    const live = isListening || isConnecting || phase === 'speaking';
    if (live) {
      wasLiveRef.current = true;
      return;
    }
    if (wasLiveRef.current && active && !voiceError) {
      wasLiveRef.current = false;
      console.warn('[coherent][voice] session ended unexpectedly', {
        phase,
        note: 'member did not toggle off; engine went idle. Re-toggle the mic to resume.',
      });
    } else if (!active) {
      wasLiveRef.current = false;
    }
  }, [isListening, isConnecting, phase, active, voiceError]);

  return {
    available: enabled && !fellBack,
    sessionOn,
    phase,
    listening: isListening,
    connecting: isConnecting,
    error: voiceError,
    toggle,
    stopSpeaking,
  };
}
