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
