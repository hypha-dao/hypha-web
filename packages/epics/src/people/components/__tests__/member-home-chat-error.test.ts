import { describe, expect, it } from 'vitest';

import { homeAssistantTurnSucceeded } from '../member-home-chat-error';

const dropped = 'The thread dropped for a moment.';

describe('homeAssistantTurnSucceeded', () => {
  it('treats a real assistant reply as finished', () => {
    expect(
      homeAssistantTurnSucceeded(
        { role: 'assistant' },
        'Hello — I am here.',
        dropped,
      ),
    ).toBe(true);
  });

  it('does not treat the dropped-thread fallback as success', () => {
    expect(
      homeAssistantTurnSucceeded({ role: 'assistant' }, dropped, dropped),
    ).toBe(false);
  });

  it('does not treat a user turn as success', () => {
    expect(homeAssistantTurnSucceeded({ role: 'user' }, 'hi', dropped)).toBe(
      false,
    );
  });
});
