import { describe, expect, it } from 'vitest';

import { shouldShowOnboardingTransparencyPicker } from '../onboarding-transparency-ui';

const activityReply = {
  id: 'a1',
  role: 'assistant',
  parts: [
    {
      type: 'text',
      text: 'Who should be able to see what goes on inside, like proposals, treasury, members and shared work? The options are Public, Network, Organisation or Space, and you can pick on the card below.',
    },
  ],
};

describe('onboarding transparency picker', () => {
  it('shows the activity card when the reply points at it without a tool part', () => {
    expect(
      shouldShowOnboardingTransparencyPicker({
        messages: [activityReply],
        isStreaming: false,
      }),
    ).toBe(true);
  });

  it('keeps the card when a later assistant line has no tool part', () => {
    expect(
      shouldShowOnboardingTransparencyPicker({
        messages: [
          {
            id: 'tool',
            role: 'assistant',
            parts: [
              { type: 'text', text: 'Pick who can find the space.' },
              {
                type: 'tool-onboarding_guidance',
                state: 'output-available',
                output: {
                  ok: true,
                  next_field: 'transparency_discoverability',
                  requires_transparency_discoverability_picker: true,
                  transparency_picker_step: 'discoverability',
                },
              },
            ],
          },
          {
            id: 'echo',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Take your time.' }],
          },
        ],
        isStreaming: false,
      }),
    ).toBe(true);
  });
});
