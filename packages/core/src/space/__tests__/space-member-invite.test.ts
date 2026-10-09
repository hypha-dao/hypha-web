import { describe, expect, it } from 'vitest';

import { splitInvitesByMembership } from '../space-member-invite';

describe('splitInvitesByMembership', () => {
  const invites = [
    { id: 1, spaceId: 10 },
    { id: 2, spaceId: 20 },
    { id: 3, spaceId: 10 },
  ];

  it('keeps invites for spaces the person has not joined', () => {
    const result = splitInvitesByMembership(invites, new Set([20]));
    expect(result.pending.map((invite) => invite.id)).toEqual([1, 3]);
    expect(result.joinedInviteIds).toEqual([2]);
  });

  it('leaves every invite pending when the person has no spaces', () => {
    const result = splitInvitesByMembership(invites, new Set());
    expect(result.pending).toHaveLength(3);
    expect(result.joinedInviteIds).toEqual([]);
  });
});
