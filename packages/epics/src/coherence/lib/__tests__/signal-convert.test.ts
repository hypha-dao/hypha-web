import { describe, expect, it } from 'vitest';
import {
  proposalPathFromSignal,
  questPathFromSignal,
  writeProposalFromSignal,
  writeQuestFromSignal,
} from '../signal-convert';

function memory() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe('signal convert', () => {
  it('opens the quest and collective proposal forms', () => {
    expect(questPathFromSignal('en', 'sandbox')).toBe(
      '/en/dho/sandbox/quests/new',
    );
    expect(proposalPathFromSignal('de', 'sandbox')).toBe(
      '/de/dho/sandbox/agreements/create',
    );
  });

  it('prefills the quest title, goal, and domain', () => {
    const storage = memory();
    writeQuestFromSignal(storage, 'sandbox', {
      title: '  Shared heat  ',
      description: 'Quiet hours for the pumps.',
      board: 'energy',
    });
    const session = JSON.parse(
      storage.getItem('hypha-quest-create:sandbox') ?? '{}',
    );
    expect(session.draft).toMatchObject({
      name: 'Shared heat',
      goal: 'Quiet hours for the pumps.',
      domain: 'energy',
      successCriteria: '',
    });
    expect(session.draftId).toBeNull();
  });

  it('prefills the proposal title and description', () => {
    const storage = memory();
    writeProposalFromSignal(storage, {
      title: 'Shared heat',
      description: 'Quiet hours for the pumps.',
      board: 'energy',
    });
    expect(JSON.parse(storage.getItem('resubmitProposalData') ?? '{}')).toEqual(
      {
        resubmitTemplateSegment: '',
        title: 'Shared heat',
        description: 'Quiet hours for the pumps.',
        applied: false,
      },
    );
  });
});
