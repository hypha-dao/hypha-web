import { describe, expect, it } from 'vitest';
import { selectDirectRecipient } from '../direct-recipient';

const bots = new Set(['@hypha_bot:hs', '@preview_bot:hs']);

describe('selectDirectRecipient', () => {
  it('returns the other human and ignores bots', () => {
    expect(
      selectDirectRecipient(
        ['@alice:hs', '@bob:hs', '@hypha_bot:hs', '@preview_bot:hs'],
        '@alice:hs',
        bots,
      ),
    ).toBe('@bob:hs');
  });

  it('counts an invited recipient who has not joined yet', () => {
    expect(
      selectDirectRecipient(
        ['@alice:hs', '@bob:hs', '@hypha_bot:hs'],
        '@alice:hs',
        bots,
      ),
    ).toBe('@bob:hs');
  });

  it('is not a private message when more than two humans are in the room', () => {
    expect(
      selectDirectRecipient(
        ['@alice:hs', '@bob:hs', '@cara:hs', '@hypha_bot:hs'],
        '@alice:hs',
        bots,
      ),
    ).toBeNull();
  });

  it('is not a private message when the sender is the only human', () => {
    expect(
      selectDirectRecipient(['@alice:hs', '@hypha_bot:hs'], '@alice:hs', bots),
    ).toBeNull();
  });

  it('ignores a sender who is not a member', () => {
    expect(
      selectDirectRecipient(['@bob:hs', '@cara:hs'], '@alice:hs', bots),
    ).toBeNull();
  });
});
