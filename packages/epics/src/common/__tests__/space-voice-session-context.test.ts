import { describe, expect, it } from 'vitest';

import {
  buildCoherentCanvasVoiceSessionContext,
  buildSpaceAdvisorVoiceSessionContext,
} from '../space-voice-session-context';

describe('buildCoherentCanvasVoiceSessionContext (#2486 M8)', () => {
  it('builds a voice-interview canvas context, space optional', () => {
    expect(buildCoherentCanvasVoiceSessionContext({})).toEqual({
      mode: 'conversational_canvas',
      discoveryMode: 'voice_interview',
    });
    expect(
      buildCoherentCanvasVoiceSessionContext({
        spaceSlug: '  ger-de-bot-031 ',
        locale: ' en ',
      }),
    ).toEqual({
      mode: 'conversational_canvas',
      discoveryMode: 'voice_interview',
      spaceSlug: 'ger-de-bot-031',
      locale: 'en',
    });
  });

  it('omits blank space/locale rather than sending empty strings', () => {
    const ctx = buildCoherentCanvasVoiceSessionContext({
      spaceSlug: '   ',
      locale: '',
    });
    expect(ctx).not.toHaveProperty('spaceSlug');
    expect(ctx).not.toHaveProperty('locale');
  });

  it('is a distinct mode from the space advisor context', () => {
    expect(
      buildSpaceAdvisorVoiceSessionContext({ spaceSlug: 'hypha' }).mode,
    ).toBe('space_advisor');
    expect(buildCoherentCanvasVoiceSessionContext({}).mode).toBe(
      'conversational_canvas',
    );
  });
});
