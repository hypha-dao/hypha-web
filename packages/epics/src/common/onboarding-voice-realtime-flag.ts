'use client';

function parseEnableFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
}

/** Build-time gate for OpenAI Realtime voice discovery (Phase 2). */
export function getClientEnableOnboardingVoiceRealtime(): boolean {
  return parseEnableFlag(
    process.env.NEXT_PUBLIC_ENABLE_ONBOARDING_VOICE_REALTIME,
  );
}
