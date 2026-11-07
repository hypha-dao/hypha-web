import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  EXISTING_QUEST_HELPER_RULES,
  NEW_QUEST_HELPER_RULES,
  assistSpaceQuestDraft,
  buildQuestHelperTurnPrompt,
} from '../quest-draft-assist';

describe('quest helper prompt', () => {
  it('sends the draft, history, and message as data, and does not auto-save a question', () => {
    expect(NEW_QUEST_HELPER_RULES).toMatch(/do not invent/i);
    expect(NEW_QUEST_HELPER_RULES).toMatch(/not saved until they confirm/i);
    expect(NEW_QUEST_HELPER_RULES).toMatch(
      /do not say the wording is waiting for confirmation/i,
    );
    expect(NEW_QUEST_HELPER_RULES).toMatch(
      /question retires any unsaved suggestion/i,
    );
    expect(NEW_QUEST_HELPER_RULES).toMatch(/chat answer/i);
    expect(NEW_QUEST_HELPER_RULES).not.toMatch(/do not rewrite it/i);
    expect(EXISTING_QUEST_HELPER_RULES).not.toContain('THE AI DOES IT FOR ME');
    expect(EXISTING_QUEST_HELPER_RULES).toMatch(
      /Do not call update_quest_draft/,
    );
    expect(EXISTING_QUEST_HELPER_RULES).not.toMatch(
      /still call update_quest_draft/i,
    );

    const prompt = buildQuestHelperTurnPrompt({
      snapshotJson: JSON.stringify({
        goal: 'Keep the confirmed goal',
      }),
      historyLines: 'Member: goal is to test quest',
      currentStep: 'goal',
      message: 'do you think that is well defined goal?',
    });
    expect(prompt).toContain('BEGIN UNTRUSTED DATA (current quest state JSON)');
    expect(prompt).toContain('Keep the confirmed goal');
    expect(prompt).toContain('BEGIN UNTRUSTED DATA (recent conversation)');
    expect(prompt).toContain('goal is to test quest');
    expect(prompt).toContain('Current guided section focus: goal');
    expect(prompt).toContain('BEGIN UNTRUSTED DATA (member message)');
    expect(prompt).toContain('do you think that is well defined goal?');
    expect(prompt).toContain('END UNTRUSTED DATA');
    expect(prompt).not.toContain('Actionable suggestion:');

    const retired = buildQuestHelperTurnPrompt({
      snapshotJson: JSON.stringify({ goal: 'Keep the confirmed goal' }),
      historyLines:
        'Quest Helper: Not saved yet. Do you want that to be in the Scope?',
      currentStep: 'scope',
      message: 'what reward should we pay?',
      suggestion: { status: 'retired', step: 'scope' },
    });
    expect(retired.startsWith('Actionable suggestion: none.')).toBe(true);
    expect(retired).toContain('Yes will not save it');
    expect(retired).toContain('Do not tell the member it is still waiting');
    expect(retired.indexOf('Actionable suggestion:')).toBeLessThan(
      retired.indexOf('BEGIN UNTRUSTED DATA'),
    );
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
    } finally {
      if (previous === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previous;
    }
  });
});
