import { describe, expect, it } from 'vitest';

import {
  acceptEnsuredPublicRoomId,
  distinctPublicRoomId,
  isSpacePublicRoomType,
  waitForAcceptedPublicRoomId,
} from '../public-room-id';
import { HYPHA_ROOM_TYPES } from '../room-types';

describe('distinctPublicRoomId', () => {
  it('keeps a public room that is not the member room', () => {
    expect(distinctPublicRoomId('!public:hs', '!space:hs')).toBe('!public:hs');
  });

  it('rejects the member room so the public channel cannot show it', () => {
    expect(distinctPublicRoomId('!space:hs', '!space:hs')).toBeNull();
    expect(distinctPublicRoomId('  !space:hs  ', '!space:hs')).toBeNull();
  });

  it('allows any resolved room when the member room is unknown', () => {
    expect(distinctPublicRoomId('!public:hs', null)).toBe('!public:hs');
    expect(distinctPublicRoomId('!public:hs', '   ')).toBe('!public:hs');
  });

  it('returns null when the alias did not resolve', () => {
    expect(distinctPublicRoomId(null, '!space:hs')).toBeNull();
    expect(distinctPublicRoomId('  ', '!space:hs')).toBeNull();
  });
});

describe('acceptEnsuredPublicRoomId', () => {
  it('accepts a typed public room that is not the member room', () => {
    expect(
      acceptEnsuredPublicRoomId(
        '!public:hs',
        '!space:hs',
        HYPHA_ROOM_TYPES.spacePublic,
      ),
    ).toBe('!public:hs');
  });

  it('rejects the member room even when it was given the public type', () => {
    expect(
      acceptEnsuredPublicRoomId(
        '!space:hs',
        '!space:hs',
        HYPHA_ROOM_TYPES.spacePublic,
      ),
    ).toBeNull();
  });

  it('rejects a member-typed room even when chatRoomId is missing', () => {
    expect(
      acceptEnsuredPublicRoomId('!space:hs', null, HYPHA_ROOM_TYPES.space),
    ).toBeNull();
    expect(isSpacePublicRoomType(HYPHA_ROOM_TYPES.space)).toBe(false);
  });

  it('rejects an untyped room even when it is distinct from the member room', () => {
    expect(acceptEnsuredPublicRoomId('!maybe:hs', null, null)).toBeNull();
    expect(acceptEnsuredPublicRoomId('!maybe:hs', null, '')).toBeNull();
    expect(
      acceptEnsuredPublicRoomId('!public:hs', '!space:hs', null),
    ).toBeNull();
    expect(
      acceptEnsuredPublicRoomId('!old-member:hs', '!stale:hs', null),
    ).toBeNull();
  });
});

describe('waitForAcceptedPublicRoomId', () => {
  it('accepts once the synced type is the public room', async () => {
    const types = [null, HYPHA_ROOM_TYPES.spacePublic];
    const accepted = await waitForAcceptedPublicRoomId({
      roomId: '!public:hs',
      memberRoomId: '!space:hs',
      readRoomType: () => types.shift() ?? HYPHA_ROOM_TYPES.spacePublic,
      waitMs: 200,
      now: () => 0,
      sleep: async () => {},
    });
    expect(accepted).toBe('!public:hs');
  });

  it('refuses a member room without waiting out the timeout', async () => {
    let slept = 0;
    const accepted = await waitForAcceptedPublicRoomId({
      roomId: '!space:hs',
      memberRoomId: null,
      readRoomType: () => HYPHA_ROOM_TYPES.space,
      waitMs: 2000,
      now: () => 0,
      sleep: async () => {
        slept += 1;
      },
    });
    expect(accepted).toBeNull();
    expect(slept).toBe(0);
  });

  it('refuses a room whose type never arrives', async () => {
    let clock = 0;
    const accepted = await waitForAcceptedPublicRoomId({
      roomId: '!maybe:hs',
      memberRoomId: '!space:hs',
      readRoomType: () => null,
      waitMs: 100,
      now: () => clock,
      sleep: async () => {
        clock = 100;
      },
    });
    expect(accepted).toBeNull();
  });
});
