import { z } from 'zod';

import { onboardingConversationContextSchema } from '../request-schema';

export const spaceAdvisorVoiceContextSchema = z.object({
  mode: z.literal('space_advisor'),
  discoveryMode: z.literal('voice_interview'),
  spaceSlug: z.string().trim().min(1).max(128),
  locale: z.string().trim().min(2).max(16).optional(),
});

export const voiceSessionContextSchema = z.discriminatedUnion('mode', [
  onboardingConversationContextSchema,
  spaceAdvisorVoiceContextSchema,
]);

export const realtimeVoiceSessionRequestSchema = z.object({
  conversationContext: voiceSessionContextSchema,
  locale: z.string().trim().min(2).max(16).optional(),
  recentTranscriptSummary: z.string().trim().max(8000).optional(),
});

export type RealtimeVoiceSessionRequest = z.infer<
  typeof realtimeVoiceSessionRequestSchema
>;

export function assertVoiceDiscoverySessionContext(
  context: RealtimeVoiceSessionRequest['conversationContext'],
): void {
  if (context.mode === 'space_advisor') {
    if (context.discoveryMode !== 'voice_interview') {
      throw new RealtimeVoiceSessionContextError(
        'Voice Realtime requires discoveryMode voice_interview.',
      );
    }
    return;
  }

  if (context.mode !== 'onboarding_setup') {
    throw new RealtimeVoiceSessionContextError(
      'Voice Realtime requires onboarding setup or space advisor context.',
    );
  }
  if (context.discoveryMode !== 'voice_interview') {
    throw new RealtimeVoiceSessionContextError(
      'Voice Realtime requires discoveryMode voice_interview.',
    );
  }
}

export class RealtimeVoiceSessionContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RealtimeVoiceSessionContextError';
  }
}
