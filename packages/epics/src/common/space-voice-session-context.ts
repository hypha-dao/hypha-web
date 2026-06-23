'use client';

import type { OnboardingConversationContext } from './ai-onboarding-context';

/** Voice Realtime session context for ongoing space advisor discovery (not onboarding setup). */
export type SpaceAdvisorVoiceSessionContext = {
  mode: 'space_advisor';
  discoveryMode: 'voice_interview';
  spaceSlug: string;
  locale?: string;
};

export type VoiceSessionContext =
  | OnboardingConversationContext
  | SpaceAdvisorVoiceSessionContext;

export function buildSpaceAdvisorVoiceSessionContext(input: {
  spaceSlug: string;
  locale?: string;
}): SpaceAdvisorVoiceSessionContext {
  return {
    mode: 'space_advisor',
    discoveryMode: 'voice_interview',
    spaceSlug: input.spaceSlug.trim(),
    ...(input.locale?.trim() ? { locale: input.locale.trim() } : {}),
  };
}

export function isSpaceAdvisorVoiceSessionContext(
  value: unknown,
): value is SpaceAdvisorVoiceSessionContext {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SpaceAdvisorVoiceSessionContext>;
  return (
    candidate.mode === 'space_advisor' &&
    candidate.discoveryMode === 'voice_interview' &&
    typeof candidate.spaceSlug === 'string' &&
    candidate.spaceSlug.trim().length > 0
  );
}
