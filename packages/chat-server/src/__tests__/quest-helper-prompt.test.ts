import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  EXISTING_QUEST_HELPER_RULES,
  assistSpaceQuestDraft,
  questHelperShownText,
  waitingQuestSuggestion,
} from '../quest-draft-assist';

describe('quest helper prompt', () => {
  it('keeps the existing-quest rules to explicit edits', () => {
    expect(EXISTING_QUEST_HELPER_RULES).not.toContain('THE AI DOES IT FOR ME');
    expect(EXISTING_QUEST_HELPER_RULES).toMatch(
      /Do not call update_quest_draft/,
    );
    expect(EXISTING_QUEST_HELPER_RULES).not.toMatch(
      /still call update_quest_draft/i,
    );
  });

  it('reads the waiting card only when it parses for its section', () => {
    expect(
      waitingQuestSuggestion({
        status: 'awaiting',
        step: 'goal',
        patch: { goal: 'Keep this goal', scopeIn: ['not this'] },
      }),
    ).toEqual({ step: 'goal', patch: { goal: 'Keep this goal' } });
    expect(
      waitingQuestSuggestion({
        status: 'none',
        step: 'goal',
        patch: { goal: 'x' },
      }),
    ).toBeNull();
    expect(
      waitingQuestSuggestion({ status: 'awaiting', step: 'goal' }),
    ).toBeNull();
    expect(
      waitingQuestSuggestion({
        status: 'awaiting',
        step: 'scope',
        patch: { goal: 'wrong section' },
      }),
    ).toBeNull();
  });

  it('counts recent helper replies, the card, and the message as shown text', () => {
    const shown = questHelperShownText({
      history: [
        { role: 'user', text: 'member typed this' },
        { role: 'assistant', text: 'one' },
        { role: 'assistant', text: 'two' },
        { role: 'assistant', text: 'three' },
        { role: 'assistant', text: 'four' },
      ],
      pendingWording: 'card wording',
      message: 'add that',
    });
    expect(shown).not.toContain('one');
    expect(shown).not.toContain('member typed this');
    expect(shown).toContain('four');
    expect(shown).toContain('card wording');
    expect(shown).toContain('add that');
  });

  it('does not call the model or write a quest when the API key is missing', async () => {
    const previous = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      const result = await assistSpaceQuestDraft({
        spaceSlug: 'not-a-real-space',
        input: { message: 'do you think that is well defined goal?' },
      });
      expect(result.reply).toBeNull();
      expect(result.patch).toBeNull();
      expect(result.updatedQuest).toBeNull();
      expect(result.helper).toBeUndefined();
    } finally {
      if (previous === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previous;
    }
  });
});
