import { describe, expect, it } from 'vitest';
import { shouldResetQuestModalDraft } from '../modal-draft-reset';

describe('quest modal draft reset', () => {
  it('resets only when the modal opens and keeps edits across a refresh', () => {
    expect(shouldResetQuestModalDraft(true, false)).toBe(true);
    expect(shouldResetQuestModalDraft(true, true)).toBe(false);
    expect(shouldResetQuestModalDraft(false, true)).toBe(false);
    expect(shouldResetQuestModalDraft(false, false)).toBe(false);
  });
});
