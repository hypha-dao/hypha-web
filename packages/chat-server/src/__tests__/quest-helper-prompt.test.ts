import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { questPendingYesNotice } from '@hypha-platform/core/client';
import {
  EXISTING_QUEST_HELPER_RULES,
  NEW_QUEST_HELPER_RULES,
  assistSpaceQuestDraft,
  buildQuestHelperTurnPrompt,
  questAssistCoachedTarget,
} from '../quest-draft-assist';

describe('quest helper prompt', () => {
  it('sends the draft, history, and message as data, and does not auto-save a question', () => {
    expect(NEW_QUEST_HELPER_RULES).toMatch(/do not invent/i);
    expect(NEW_QUEST_HELPER_RULES).toMatch(
      /do not say whether anything is waiting, saved, not saved, or suggested above/i,
    );
    expect(NEW_QUEST_HELPER_RULES).toMatch(
      /question retires any unsaved suggestion/i,
    );
    expect(NEW_QUEST_HELPER_RULES).toMatch(/chat answer/i);
    expect(NEW_QUEST_HELPER_RULES).toMatch(
      /do not tell them to use a put command/i,
    );
    expect(NEW_QUEST_HELPER_RULES).toMatch(
      /do not leave that wording only in prose/i,
    );
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

    const preserved = buildQuestHelperTurnPrompt({
      snapshotJson: JSON.stringify({ goal: 'Keep the confirmed goal' }),
      historyLines: 'Quest Helper: earlier scope wording',
      currentStep: 'scope',
      message: 'Add lead scoring',
      suggestion: { status: 'awaiting', step: 'scope' },
    });
    const scopeNotice = questPendingYesNotice('scope');
    expect(preserved.startsWith('Actionable suggestion: preserved.')).toBe(
      true,
    );
    expect(preserved).toContain(scopeNotice);
    expect(preserved).toContain('Do not contradict that sentence');
    expect(preserved).toContain(
      'Do not say the suggestion is history, retired, cleared, or no longer waiting.',
    );
    expect(preserved).not.toMatch(/suggestion is history because/i);
    expect(preserved.indexOf('Actionable suggestion:')).toBeLessThan(
      preserved.indexOf('BEGIN UNTRUSTED DATA'),
    );

    const revising = buildQuestHelperTurnPrompt({
      snapshotJson: JSON.stringify({ goal: 'Keep the confirmed goal' }),
      historyLines: 'Quest Helper: earlier goal wording',
      currentStep: 'scope',
      message: 'no, make it shorter still and drop the word sandbox',
      suggestion: {
        status: 'revising',
        step: 'goal',
        wording: 'Ship a shorter sandbox checklist for new members.',
      },
    });
    expect(revising.startsWith('Actionable suggestion: replace it.')).toBe(
      true,
    );
    expect(revising).toContain('pending suggestion wording');
    expect(revising).toContain(
      'Ship a shorter sandbox checklist for new members.',
    );
    expect(revising).toContain(
      'Do not ask the member to repeat the pending wording',
    );
    expect(revising).toContain('The earlier suggestion will not stay waiting');
    expect(NEW_QUEST_HELPER_RULES).toContain('remove a bullet');
    expect(revising).toContain('Do not tell them to use a Put command');
    expect(revising).not.toMatch(/suggestion is history because/i);
    expect(
      questAssistCoachedTarget(
        'Please propose a shorter version of the goal for my confirmation',
        'scope',
      ),
    ).toEqual({ step: 'goal', bulk: false });
    expect(
      questAssistCoachedTarget(
        'no, make it shorter still and drop the word sandbox',
        'scope',
        { status: 'revising', step: 'goal' },
      ),
    ).toEqual({ step: 'goal', bulk: false });
    expect(
      questAssistCoachedTarget(
        'Please propose these success criteria for my confirmation: each in-scope check is recorded with an explicit pass or fail; the lead reviews the notes.',
        'success',
      ),
    ).toEqual({ step: 'success', bulk: false });
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
