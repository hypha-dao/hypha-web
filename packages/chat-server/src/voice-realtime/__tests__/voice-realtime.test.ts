import { describe, expect, it } from 'vitest';

import { buildOnboardingRealtimeInstructions } from '../system-instructions';
import { buildSpaceAdvisorRealtimeInstructions } from '../system-instructions';
import { buildCoherentCanvasRealtimeInstructions } from '../system-instructions';
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
  it('accepts space advisor voice discovery context', () => {
    const parsed = realtimeVoiceSessionRequestSchema.safeParse({
      conversationContext: {
        mode: 'space_advisor',
        discoveryMode: 'voice_interview',
        spaceSlug: 'hypha-platform',
      },
      locale: 'en',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a Coherent canvas voice context, with or without a space', () => {
    expect(
      realtimeVoiceSessionRequestSchema.safeParse({
        conversationContext: {
          mode: 'conversational_canvas',
          discoveryMode: 'voice_interview',
        },
        locale: 'en',
      }).success,
    ).toBe(true);
    expect(
      realtimeVoiceSessionRequestSchema.safeParse({
        conversationContext: {
          mode: 'conversational_canvas',
          discoveryMode: 'voice_interview',
          spaceSlug: 'ger-de-bot-031',
        },
      }).success,
    ).toBe(true);
  });
});

describe('assertVoiceDiscoverySessionContext', () => {
  it('allows space advisor voice discovery', () => {
    expect(() =>
      assertVoiceDiscoverySessionContext({
        mode: 'space_advisor',
        discoveryMode: 'voice_interview',
        spaceSlug: 'hypha-platform',
      }),
    ).not.toThrow();
  });

  it('requires voice_interview discovery mode', () => {
    expect(() =>
      assertVoiceDiscoverySessionContext({
        mode: 'onboarding_setup',
        discoveryMode: 'chat',
      }),
    ).toThrow(RealtimeVoiceSessionContextError);
  });

  it('allows Coherent canvas voice discovery, rejects non-voice discovery', () => {
    expect(() =>
      assertVoiceDiscoverySessionContext({
        mode: 'conversational_canvas',
        discoveryMode: 'voice_interview',
        spaceSlug: 'ger-de-bot-031',
      }),
    ).not.toThrow();
    expect(() =>
      assertVoiceDiscoverySessionContext({
        mode: 'conversational_canvas',
        discoveryMode: 'chat',
      } as never),
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
    expect(instructions).toContain('English');
  });

  it('includes locale language for non-English onboarding', () => {
    const instructions = buildOnboardingRealtimeInstructions({
      setupPhase: 'discover',
      locale: 'de',
    });
    expect(instructions).toContain('German');
  });
});

describe('buildSpaceAdvisorRealtimeInstructions', () => {
  it('includes continuous discovery guidance for a live space', () => {
    const instructions = buildSpaceAdvisorRealtimeInstructions({
      spaceSlug: 'hypha-platform',
      locale: 'en',
      recentTranscriptSummary: 'User asked about treasury diversification.',
    });
    expect(instructions).toContain('hypha-platform');
    expect(instructions).toContain('Continuous space discovery');
    expect(instructions).toContain('treasury diversification');
    expect(instructions).toContain('Do NOT call onboarding_guidance');
    expect(instructions).toContain('organisational gaps');
    expect(instructions).toContain('get_space_by_slug');
  });
});

describe('buildCoherentCanvasRealtimeInstructions', () => {
  it('is a lean speak-only brief — no "canvas", points at the screen', () => {
    const instructions = buildCoherentCanvasRealtimeInstructions({
      locale: 'en',
      spaceSlug: 'ger-de-bot-031',
      recentTranscriptSummary: 'Member reviewed the treasury.',
    });
    expect(instructions).toContain('on screen');
    expect(instructions).toContain("Point, don't recite");
    expect(instructions).toContain('ger-de-bot-031');
    expect(instructions).toContain('Member reviewed the treasury.');
    expect(instructions).toContain('English');
    // Never leak the internal term to a spoken persona.
    expect(instructions.toLowerCase()).not.toContain('canvas');
    // It must NOT drag in the full advisor / tool guidance.
    expect(instructions).not.toContain('get_space_by_slug');
    expect(instructions).not.toContain('onboarding_guidance');
  });

  it('omits the space line when no space is scoped', () => {
    const instructions = buildCoherentCanvasRealtimeInstructions({
      locale: 'en',
    });
    expect(instructions).not.toContain('currently about the space');
  });
});
