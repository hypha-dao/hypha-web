import { describe, expect, it } from 'vitest';

import { isAutoJoinGroupInvite } from '../group-room';

const bot = '@hypha-bot:hypha.earth';

describe('group room invite', () => {
  it('joins a bot-created group the member was only invited to', () => {
    expect(
      isAutoJoinGroupInvite({
        membership: 'invite',
        canonicalAlias: null,
        roomName: 'Ada Lovelace, Grace Hopper',
        creatorUserId: bot,
        botUserId: bot,
      }),
    ).toBe(true);
  });

  it('leaves space rooms, direct rooms, and outside invites alone', () => {
    expect(
      isAutoJoinGroupInvite({
        membership: 'invite',
        canonicalAlias: '#space:hypha.earth',
        roomName: 'Water, Food',
        creatorUserId: bot,
        botUserId: bot,
      }),
    ).toBe(false);
    expect(
      isAutoJoinGroupInvite({
        membership: 'invite',
        canonicalAlias: null,
        roomName: 'Ada Lovelace',
        creatorUserId: bot,
        botUserId: bot,
      }),
    ).toBe(false);
    expect(
      isAutoJoinGroupInvite({
        membership: 'join',
        canonicalAlias: null,
        roomName: 'Ada Lovelace, Grace Hopper',
        creatorUserId: bot,
        botUserId: bot,
      }),
    ).toBe(false);
    expect(
      isAutoJoinGroupInvite({
        membership: 'invite',
        canonicalAlias: null,
        roomName: 'Ada Lovelace, Grace Hopper',
        creatorUserId: '@someone:hypha.earth',
        botUserId: bot,
      }),
    ).toBe(false);
  });
});
