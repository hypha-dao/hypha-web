import { describe, expect, it } from 'vitest';

import {
  latestMessageTs,
  peerLastSeenLine,
  preferPresence,
  presenceFromMatrixStatus,
  presenceFromRecency,
  presenceRank,
  readMemberPresence,
  readMemberPresenceDetail,
  sortByPresenceThenShared,
  sortByRecencyThenPresence,
} from '../member-presence';

describe('presenceFromMatrixStatus', () => {
  it('maps Matrix online to active', () => {
    expect(presenceFromMatrixStatus({ presence: 'online' })).toBe('active');
    expect(
      presenceFromMatrixStatus({ presence: 'online', currently_active: true }),
    ).toBe('active');
  });

  it('maps unavailable and inactive online to idle', () => {
    expect(presenceFromMatrixStatus({ presence: 'unavailable' })).toBe('idle');
    expect(
      presenceFromMatrixStatus({
        presence: 'online',
        currently_active: false,
      }),
    ).toBe('idle');
  });

  it('maps offline and unknown to offline', () => {
    expect(presenceFromMatrixStatus({ presence: 'offline' })).toBe('offline');
    expect(presenceFromMatrixStatus({})).toBe('offline');
    expect(
      presenceFromMatrixStatus({ presence: 'offline', last_active_ago: 0 }),
    ).toBe('offline');
  });

  it('keeps a recent last-active time when the flag already says offline', () => {
    expect(
      presenceFromMatrixStatus({
        presence: 'offline',
        last_active_ago: 60_000,
      }),
    ).toBe('active');
    expect(
      presenceFromMatrixStatus({
        presence: 'offline',
        last_active_ago: 10 * 60_000,
      }),
    ).toBe('idle');
  });
});

describe('readMemberPresence', () => {
  const now = 1_700_000_000_000;

  it('does not let an empty live status hide a synced online user', async () => {
    const level = await readMemberPresence(
      {
        getPresence: async () => ({ presence: 'offline' }),
        getUser: () => ({
          presence: 'online',
          currentlyActive: true,
          lastPresenceTs: now - 1_000,
        }),
      },
      '@ada:hypha',
      now,
    );
    expect(level).toBe('active');
    expect(preferPresence(['offline', 'idle'])).toBe('idle');
  });

  it('lights the signed-in session even when the homeserver says offline', async () => {
    const level = await readMemberPresence(
      {
        getPresence: async () => ({ presence: 'offline' }),
        getUserId: () => '@me:hypha',
      },
      '@me:hypha',
      now,
    );
    expect(level).toBe('active');
  });

  it('exposes last-active time from the homeserver for the DM header', async () => {
    const now = 1_700_000_000_000;
    const ago = 2 * 60 * 60_000;
    const detail = await readMemberPresenceDetail(
      {
        getPresence: async () => ({
          presence: 'offline',
          last_active_ago: ago,
        }),
      },
      '@ada:hypha',
      now,
    );
    expect(detail.known).toBe(true);
    expect(detail.level).toBe('offline');
    expect(detail.lastActiveAt).toBe(now - ago);
    expect(peerLastSeenLine(detail)).toEqual({
      kind: 'lastSeenAt',
      at: now - ago,
    });
  });

  it('hides the DM last-seen line when presence probes fail', async () => {
    const detail = await readMemberPresenceDetail(
      {
        getPresence: async () => {
          throw new Error('presence disabled');
        },
      },
      '@ada:hypha',
    );
    expect(detail.known).toBe(false);
    expect(peerLastSeenLine(detail)).toEqual({ kind: 'hidden' });
  });

  it('uses the latest message as last-seen when presence is offline without ago', async () => {
    const messageAt = now - 45 * 60_000;
    const detail = await readMemberPresenceDetail(
      {
        getPresence: async () => ({ presence: 'offline' }),
        getRooms: () => [
          {
            getLiveTimeline: () => ({
              getEvents: () => [
                {
                  getSender: () => '@ada:hypha',
                  getType: () => 'm.room.message',
                  getTs: () => messageAt,
                },
              ],
            }),
          },
        ],
      },
      '@ada:hypha',
      now,
    );
    expect(detail.known).toBe(true);
    expect(detail.matrixLevel).toBe('offline');
    expect(detail.lastActiveAt).toBe(messageAt);
    expect(peerLastSeenLine(detail)).toEqual({
      kind: 'lastSeenAt',
      at: messageAt,
    });
  });

  it('does not show online when Matrix is offline but a recent message exists', async () => {
    const messageAt = now - 60_000;
    const detail = await readMemberPresenceDetail(
      {
        getPresence: async () => ({ presence: 'offline' }),
        getRooms: () => [
          {
            getLiveTimeline: () => ({
              getEvents: () => [
                {
                  getSender: () => '@ada:hypha',
                  getType: () => 'm.room.message',
                  getTs: () => messageAt,
                },
              ],
            }),
          },
        ],
      },
      '@ada:hypha',
      now,
    );
    expect(detail.level).toBe('active');
    expect(detail.matrixLevel).toBe('offline');
    expect(peerLastSeenLine(detail)).toEqual({
      kind: 'lastSeenAt',
      at: messageAt,
    });
  });

  it('uses a recent message when no presence event exists', async () => {
    const level = await readMemberPresence(
      {
        getPresence: async () => {
          throw new Error('presence disabled');
        },
        getRooms: () => [
          {
            getLiveTimeline: () => ({
              getEvents: () => [
                {
                  getSender: () => '@ada:hypha',
                  getType: () => 'm.room.message',
                  getTs: () => now - 60_000,
                },
              ],
            }),
          },
        ],
      },
      '@ada:hypha',
      now,
    );
    expect(level).toBe('active');
    expect(presenceFromRecency(now - 20 * 60_000, now)).toBe('idle');
    expect(presenceFromRecency(now - 2 * 60 * 60_000, now)).toBeNull();
  });

  it('ignores state events and other senders', () => {
    const ts = latestMessageTs(
      {
        getRooms: () => [
          {
            getLiveTimeline: () => ({
              getEvents: () => [
                {
                  getSender: () => '@ada:hypha',
                  getType: () => 'm.room.member',
                  getTs: () => now,
                },
                {
                  getSender: () => '@other:hypha',
                  getType: () => 'm.room.message',
                  getTs: () => now,
                },
              ],
            }),
          },
        ],
      },
      '@ada:hypha',
    );
    expect(ts).toBeNull();
  });
});

describe('sort helpers', () => {
  it('puts active people before idle and offline', () => {
    const presence = new Map([
      [1, 'offline' as const],
      [2, 'active' as const],
      [3, 'idle' as const],
    ]);
    const ranked = sortByPresenceThenShared(
      [
        { id: 1, sharedSpaceCount: 99 },
        { id: 2, sharedSpaceCount: 1 },
        { id: 3, sharedSpaceCount: 50 },
      ],
      presence,
    );
    expect(ranked.map((person) => person.id)).toEqual([2, 3, 1]);
  });

  it('keeps latest messages first on the connections list', () => {
    const presence = new Map([
      [1, 'offline' as const],
      [2, 'active' as const],
    ]);
    const ranked = sortByRecencyThenPresence(
      [
        {
          person: { id: 1 },
          name: 'Offline recent',
          lastTs: 200,
        },
        {
          person: { id: 2 },
          name: 'Active older',
          lastTs: 100,
        },
      ],
      presence,
    );
    expect(ranked.map((row) => row.person.id)).toEqual([1, 2]);
    expect(presenceRank('active')).toBeLessThan(presenceRank('idle'));
  });

  it('puts unread conversations above quieter ones', () => {
    const presence = new Map([
      [1, 'active' as const],
      [2, 'offline' as const],
    ]);
    const ranked = sortByRecencyThenPresence(
      [
        {
          person: { id: 1 },
          name: 'Active quiet',
          lastTs: 500,
          unread: 0,
        },
        {
          person: { id: 2 },
          name: 'Unread older',
          lastTs: 100,
          unread: 1,
        },
      ],
      presence,
    );
    expect(ranked.map((row) => row.person.id)).toEqual([2, 1]);
  });
});
