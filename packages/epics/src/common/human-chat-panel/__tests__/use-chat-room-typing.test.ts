import { describe, expect, it, vi } from 'vitest';

import {
  resolveTypingPeerName,
  typingPeersFromUserIds,
} from '../use-chat-room-typing';

describe('resolveTypingPeerName', () => {
  it('keeps a real resolved name', () => {
    expect(
      resolveTypingPeerName('@alex:hypha', () => 'Alex Prate', 'Unknown', {
        name: 'Ignored Matrix',
      } as never),
    ).toBe('Alex Prate');
  });

  it('falls through Unknown to Matrix member display name', () => {
    expect(
      resolveTypingPeerName('@vlad:hypha', () => 'Unknown', 'Unknown', {
        name: 'Vlad Kampers',
      } as never),
    ).toBe('Vlad Kampers');
  });

  it('falls through empty resolve to Matrix member display name', () => {
    expect(
      resolveTypingPeerName('@vlad:hypha', () => '', 'Unknown', {
        name: 'Vlad Kampers',
      } as never),
    ).toBe('Vlad Kampers');
  });

  it('returns Unknown only when nothing visible is available', () => {
    expect(
      resolveTypingPeerName(
        '@prod_privy_abc:hypha.chat',
        () => 'Unknown',
        'Unknown',
        { name: '@prod_privy_abc:hypha.chat' } as never,
      ),
    ).toBe('Unknown');
  });

  it('skips a technical member.name and uses rawDisplayName', () => {
    expect(
      resolveTypingPeerName(
        '@prod_privy_abc:hypha.chat',
        () => 'Unknown',
        'Unknown',
        {
          name: '@prod_privy_abc:hypha.chat',
          rawDisplayName: 'Vlad Kampers',
        } as never,
      ),
    ).toBe('Vlad Kampers');
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
      (id) => (id === '@alex:hypha' ? 'Alex' : 'Unknown'),
      'Unknown',
    );

    expect(peers).toEqual([
      { userId: '@alex:hypha', name: 'Alex' },
      { userId: '@vlad:hypha', name: 'Vlad From Room' },
    ]);
  });
});
