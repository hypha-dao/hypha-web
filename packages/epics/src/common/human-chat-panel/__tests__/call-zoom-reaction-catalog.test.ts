import { describe, expect, it } from 'vitest';
import { isValidReactionKey } from '@hypha-platform/core/client';
import {
  CALL_BE_RIGHT_BACK_EMOJI,
  CALL_FEEDBACK_REACTIONS,
  CALL_SEND_WITH_EFFECT_EMOJIS,
  CALL_STANDARD_REACTION_EMOJIS,
} from '../call-zoom-reaction-catalog';

describe('call-zoom-reaction-catalog', () => {
  it('all catalog emojis are valid Matrix reaction keys', () => {
    const all = [
      ...CALL_SEND_WITH_EFFECT_EMOJIS,
      ...CALL_STANDARD_REACTION_EMOJIS,
      ...CALL_FEEDBACK_REACTIONS.map((r) => r.emoji),
      CALL_BE_RIGHT_BACK_EMOJI,
    ];
    for (const emoji of all) {
      expect(isValidReactionKey(emoji), emoji).toBe(true);
    }
  });
});
