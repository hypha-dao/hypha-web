'use client';

import type { OnboardingConversationContext } from './ai-onboarding-context';

/** Voice Realtime session context for ongoing space advisor discovery (not onboarding setup). */
export type SpaceAdvisorVoiceSessionContext = {
  mode: 'space_advisor';
  discoveryMode: 'voice_interview';
  spaceSlug: string;
  locale?: string;
};

/**
 * #2486 M8 — voice Realtime session context for the talk-first Coherent
 * entrypoint. Speech-to-text + text-to-speech only; the turn itself runs through
 * `/api/chat` in `conversational_canvas` mode. `spaceSlug` is optional (the
 * conversation may not be scoped to a space yet).
 */
export type CoherentCanvasVoiceSessionContext = {
  mode: 'conversational_canvas';
  discoveryMode: 'voice_interview';
  spaceSlug?: string;
  locale?: string;
};

export type VoiceSessionContext =
  | OnboardingConversationContext
  | SpaceAdvisorVoiceSessionContext
  | CoherentCanvasVoiceSessionContext;

export function buildCoherentCanvasVoiceSessionContext(input: {
  spaceSlug?: string;
  locale?: string;
}): CoherentCanvasVoiceSessionContext {
  const spaceSlug = input.spaceSlug?.trim();
  const locale = input.locale?.trim();
  return {
    mode: 'conversational_canvas',
    discoveryMode: 'voice_interview',
    ...(spaceSlug ? { spaceSlug } : {}),
    ...(locale ? { locale } : {}),
  };
}

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
