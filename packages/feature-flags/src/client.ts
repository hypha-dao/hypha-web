import { parseBoolean } from './parse-boolean';

/** Client-safe build-time gate for network map + space location UI. */
export function getEnableNetworkMap(): boolean {
  return parseBoolean(process.env.NEXT_PUBLIC_ENABLE_NETWORK_MAP) ?? false;
}

/** Client-safe build-time gate for OpenAI Realtime voice discovery (Phase 2). */
export function getEnableOnboardingVoiceRealtime(): boolean {
  return (
    parseBoolean(process.env.NEXT_PUBLIC_ENABLE_ONBOARDING_VOICE_REALTIME) ??
    false
  );
}

/**
 * Client-safe build-time gate for Document Picture-in-Picture during calls.
 * Defaults on; set `NEXT_PUBLIC_ENABLE_CALL_DOCUMENT_PIP=false` as an instant
 * rollback if it needs to come back down without a code change.
 */
export function getEnableCallDocumentPip(): boolean {
  return parseBoolean(process.env.NEXT_PUBLIC_ENABLE_CALL_DOCUMENT_PIP) ?? true;
}

/**
 * Client-safe build-time gate for the #2486 talk-first assistant entrypoint.
 * Defaults off; the server reads toolbar overrides too via `getEnableAssistantAsync`.
 */
export function getEnableAssistant(): boolean {
  return parseBoolean(process.env.NEXT_PUBLIC_ENABLE_ASSISTANT) ?? false;
}

/** Client-safe build-time gate for real voice in the #2486 assistant canvas. */
export function getEnableAssistantVoice(): boolean {
  return parseBoolean(process.env.NEXT_PUBLIC_ENABLE_ASSISTANT_VOICE) ?? false;
}
