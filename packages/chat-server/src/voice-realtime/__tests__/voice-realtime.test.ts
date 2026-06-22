import { describe, expect, it } from 'vitest';

import { buildOnboardingRealtimeInstructions } from '../system-instructions';
import {
  assertVoiceDiscoverySessionContext,
  RealtimeVoiceSessionContextError,
  realtimeVoiceSessionRequestSchema,
} from '../request-schema';

describe('realtimeVoiceSessionRequestSchema', () => {
  it('accepts onboarding voice discovery context', () => {
    const parsed = realtimeVoiceSessionRequestSchema.safeParse({
      conversationContext: {
        mode: 'onboarding_setup',
        discoveryMode: 'voice_interview',
        setupPhase: 'discover',
      },
      locale: 'en',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects missing conversation context fields', () => {
    const parsed = realtimeVoiceSessionRequestSchema.safeParse({
      conversationContext: { mode: 'onboarding_setup' },
    });
    expect(parsed.success).toBe(true);
  });
});

describe('assertVoiceDiscoverySessionContext', () => {
  it('requires voice_interview discovery mode', () => {
    expect(() =>
      assertVoiceDiscoverySessionContext({
        mode: 'onboarding_setup',
        discoveryMode: 'chat',
      }),
    ).toThrow(RealtimeVoiceSessionContextError);
  });
});

describe('buildOnboardingRealtimeInstructions', () => {
  it('includes voice discovery and setup phase', () => {
    const instructions = buildOnboardingRealtimeInstructions({
      setupPhase: 'discover',
      locale: 'en',
      recentTranscriptSummary: 'User wants a bioregion DAO.',
    });
    expect(instructions).toContain('voice discovery');
    expect(instructions).toContain('discover');
    expect(instructions).toContain('User wants a bioregion DAO.');
    expect(instructions).toContain('onboarding_guidance');
    expect(instructions).toContain('Respond in English');
  });

  it('includes locale language for non-English onboarding', () => {
    const instructions = buildOnboardingRealtimeInstructions({
      setupPhase: 'discover',
      locale: 'de',
    });
    expect(instructions).toContain('Respond in German');
  });
});
