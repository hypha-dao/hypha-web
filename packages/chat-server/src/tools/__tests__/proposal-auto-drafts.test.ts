import { describe, expect, it } from 'vitest';

import {
  buildSilentProposalDrafts,
  hasChoiceFieldAccepted,
} from '../proposal-auto-drafts';

describe('proposal auto-drafts', () => {
  it('drafts title and description when entry method is accepted', () => {
    const drafts = buildSilentProposalDrafts('change_entry_method', {
      entry_method: 'open_access',
    });
    expect(drafts.title).toBe('Change Entry Method to Open Access');
    expect(drafts.description).toMatch(/join instantly/i);
  });

  it('localizes entry method drafts for French', () => {
    const drafts = buildSilentProposalDrafts(
      'change_entry_method',
      { entry_method: 'open_access' },
      'fr',
    );
    expect(drafts.title).toBe("Changer la méthode d'entrée pour Accès ouvert");
    expect(drafts.description).toMatch(/rejoindre instantanément/i);
  });

  it('drafts title and description when voting method is accepted', () => {
    const drafts = buildSilentProposalDrafts('change_voting_method', {
      voting_method: '1m1v',
    });
    expect(drafts.title).toBe('Change Voting Method to 1 Member 1 Vote');
    expect(drafts.description).toMatch(/member/i);
  });

  it('does not overwrite explicit title or description', () => {
    const drafts = buildSilentProposalDrafts('change_entry_method', {
      entry_method: 'invite_only',
      title: 'Custom title',
      description: 'Custom description.',
    });
    expect(drafts.title).toBeUndefined();
    expect(drafts.description).toBeUndefined();
  });

  it('detects choice field acceptance', () => {
    expect(
      hasChoiceFieldAccepted('change_entry_method', {
        entry_method: 'open_access',
      }),
    ).toBe(true);
    expect(hasChoiceFieldAccepted('change_entry_method', {})).toBe(false);
  });
});
