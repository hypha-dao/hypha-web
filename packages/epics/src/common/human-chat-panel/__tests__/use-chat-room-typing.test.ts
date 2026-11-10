import { describe, expect, it, vi } from 'vitest';

import {
  formatTypingIndicatorLabel,
  typingPeersFromUserIds,
  visibleTypingPeerName,
} from '../use-chat-room-typing';

const typingCopy = {
  someone: 'Someone is typing…',
  one: (name: string) => `${name} is typing…`,
  two: (name: string, other: string) => `${name} and ${other} are typing…`,
  nameAndSomeone: (name: string) => `${name} and someone are typing…`,
  many: (count: number) => `${count} people are typing…`,
};

describe('visibleTypingPeerName', () => {
  it('keeps a real resolved name', () => {
    expect(
      visibleTypingPeerName('@alex:hypha', () => 'Alex Prate', 'Member', {
        name: 'Ignored',
      } as never),
    ).toBe('Alex Prate');
  });

  it('skips the loading fallback and uses the Matrix display name', () => {
    expect(
      visibleTypingPeerName('@vlad:hypha', () => 'Member', 'Member', {
        name: 'Vlad Kampers',
      } as never),
    ).toBe('Vlad Kampers');
  });

  it('returns empty when the only labels are the fallback or a Privy id', () => {
    expect(
      visibleTypingPeerName(
        '@prod_privy_abc:hypha.chat',
        () => 'Member',
        'Member',
        { name: '@prod_privy_abc:hypha.chat' } as never,
      ),
    ).toBe('');
  });
});

describe('formatTypingIndicatorLabel', () => {
  it('says someone while the name is still loading', () => {
    expect(formatTypingIndicatorLabel([{ name: '' }], typingCopy)).toBe(
      'Someone is typing…',
    );
  });

  it('uses the real name once it arrives', () => {
    expect(formatTypingIndicatorLabel([{ name: 'Alex' }], typingCopy)).toBe(
      'Alex is typing…',
    );
  });

  it('does not pair a real name with the empty fallback', () => {
    expect(
      formatTypingIndicatorLabel([{ name: 'Alex' }, { name: '' }], typingCopy),
    ).toBe('Alex and someone are typing…');
  });
});

describe('typingPeersFromUserIds', () => {
  it('skips self and resolves display names', () => {
    const getMember = vi.fn((userId: string) =>
      userId === '@vlad:hypha'
        ? ({ name: 'Vlad From Room' } as { name: string })
        : null,
    );
    const client = {
      getUserId: () => '@me:hypha',
      getRoom: () => ({ getMember }),
    } as never;

    const peers = typingPeersFromUserIds(
      client,
      '!room:hypha',
      ['@me:hypha', '@vlad:hypha', '@alex:hypha'],
      (id) => (id === '@alex:hypha' ? 'Alex' : 'Member'),
      'Member',
    );

    expect(peers).toEqual([
      { userId: '@alex:hypha', name: 'Alex' },
      { userId: '@vlad:hypha', name: 'Vlad From Room' },
    ]);
  });
});
