import { z } from 'zod';

import { onboardingConversationContextSchema } from '../request-schema';

export const realtimeVoiceSessionRequestSchema = z.object({
  conversationContext: onboardingConversationContextSchema,
  locale: z.string().trim().min(2).max(16).optional(),
  recentTranscriptSummary: z.string().trim().max(8000).optional(),
});

export type RealtimeVoiceSessionRequest = z.infer<
  typeof realtimeVoiceSessionRequestSchema
>;

export function assertVoiceDiscoverySessionContext(
  context: RealtimeVoiceSessionRequest['conversationContext'],
): void {
  if (context.mode !== 'onboarding_setup') {
    throw new RealtimeVoiceSessionContextError(
      'Voice Realtime is only available during onboarding setup.',
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
