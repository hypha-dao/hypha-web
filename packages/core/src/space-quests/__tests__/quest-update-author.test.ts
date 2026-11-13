import { describe, expect, it } from 'vitest';
import {
  QUEST_PROPOSAL_ACCEPTED_TEXT,
  questUpdateAuthorForDisplay,
} from '../quest-update-author';

const lead = {
  authorPersonId: 7,
  authorName: 'Ada Lovelace',
  authorAvatarUrl: null as string | null,
  text: QUEST_PROPOSAL_ACCEPTED_TEXT,
};

describe('questUpdateAuthorForDisplay', () => {
  it('keeps a photo that was stored with the update', () => {
    const shown = questUpdateAuthorForDisplay(
      {
        ...lead,
        authorAvatarUrl: 'https://example.com/stored.png',
      },
      new Map([[7, { avatarUrl: 'https://example.com/current.png' }]]),
      {
        authorPersonId: 12,
        authorName: 'Grace Hopper',
        authorAvatarUrl: 'https://example.com/grace.png',
      },
    );
    expect(shown.authorAvatarUrl).toBe('https://example.com/stored.png');
    expect(shown.authorPersonId).toBe(7);
  });

  it('uses the stored author photo when the row itself has none', () => {
    const shown = questUpdateAuthorForDisplay(
      lead,
      new Map([[7, { avatarUrl: 'https://example.com/ada.png' }]]),
      null,
    );
    expect(shown).toEqual({
      authorPersonId: 7,
      authorName: 'Ada Lovelace',
      authorAvatarUrl: 'https://example.com/ada.png',
    });
  });

  it('shows the proposal creator on an acceptance row whose author has no photo', () => {
    const shown = questUpdateAuthorForDisplay(
      lead,
      new Map([[7, { avatarUrl: null }]]),
      {
        authorPersonId: 12,
        authorName: 'Grace Hopper',
        authorAvatarUrl: 'https://example.com/grace.png',
      },
    );
    expect(shown).toEqual({
      authorPersonId: 12,
      authorName: 'Grace Hopper',
      authorAvatarUrl: 'https://example.com/grace.png',
    });
  });

  it('does not borrow the proposal creator for a different update', () => {
    const shown = questUpdateAuthorForDisplay(
      { ...lead, text: 'Updated Goal.' },
      new Map([[7, { avatarUrl: null }]]),
      {
        authorPersonId: 12,
        authorName: 'Grace Hopper',
        authorAvatarUrl: 'https://example.com/grace.png',
      },
    );
    expect(shown.authorPersonId).toBe(7);
    expect(shown.authorAvatarUrl).toBeNull();
  });

  it('keeps the placeholder when neither author has a photo', () => {
    const shown = questUpdateAuthorForDisplay(
      lead,
      new Map([[7, { avatarUrl: '  ' }]]),
      {
        authorPersonId: 12,
        authorName: 'Grace Hopper',
        authorAvatarUrl: null,
      },
    );
    expect(shown.authorAvatarUrl).toBeNull();
    expect(shown.authorPersonId).toBe(7);
  });
});
