import { describe, expect, it, vi } from 'vitest';

import { typingPeersFromUserIds } from '../use-chat-room-typing';

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
      (id) => (id === '@alex:hypha' ? 'Alex' : ''),
    );

    expect(peers).toEqual([
      { userId: '@alex:hypha', name: 'Alex' },
      { userId: '@vlad:hypha', name: 'Vlad From Room' },
    ]);
  });
});
