import { describe, expect, it } from 'vitest';
import { EventType } from 'matrix-js-sdk';
import {
  SCREENSHARE_TAKEOVER_TYPE,
  canStartLocalScreenshare,
  isRemoteScreenshareActive,
  resolveIncomingScreenshareTakeover,
  resolveScreenshareTakeoverOutcome,
} from '../client/hooks/screenshare-takeover';

function takeoverEvent(
  action: string,
  requestId: string,
  requesterUserId: string,
  targetUserId?: string,
) {
  return {
    getType: () => EventType.RoomMessage,
    getTs: () => Date.now(),
    getContent: () => ({
      [SCREENSHARE_TAKEOVER_TYPE]: true,
      action,
      request_id: requestId,
      requester_user_id: requesterUserId,
      ...(targetUserId ? { target_user_id: targetUserId } : {}),
    }),
  };
}

describe('resolveIncomingScreenshareTakeover', () => {
  it('returns pending request for the local sharer', () => {
    const requestId = 'req-1';
    const incoming = resolveIncomingScreenshareTakeover(
      [takeoverEvent('request', requestId, '@bob:hs', '@alice:hs') as never],
      '@alice:hs',
      true,
      (id) => (id === '@bob:hs' ? 'Bob' : id),
    );
    expect(incoming).toEqual({
      requestId,
      requesterUserId: '@bob:hs',
      requesterLabel: 'Bob',
    });
  });

  it('ignores answered requests', () => {
    const requestId = 'req-2';
    const incoming = resolveIncomingScreenshareTakeover(
      [
        takeoverEvent('deny', requestId, '@bob:hs', '@alice:hs') as never,
        takeoverEvent('request', requestId, '@bob:hs', '@alice:hs') as never,
      ],
      '@alice:hs',
      true,
      (id) => id,
    );
    expect(incoming).toBeNull();
  });
});

describe('resolveScreenshareTakeoverOutcome', () => {
  it('returns approved for the requester', () => {
    const requestId = 'req-3';
    const outcome = resolveScreenshareTakeoverOutcome(
      [takeoverEvent('approve', requestId, '@bob:hs', '@alice:hs') as never],
      '@bob:hs',
      requestId,
    );
    expect(outcome).toBe('approved');
  });
});

describe('single-presenter share policy', () => {
  it('detects remote screenshare feeds', () => {
    const groupCall = {
      isScreensharing: () => false,
      screenshareFeeds: [
        { isLocal: () => false, userId: '@bob:hs', deviceId: 'd1' },
      ],
    } as never;
    expect(isRemoteScreenshareActive(groupCall)).toBe(true);
    expect(canStartLocalScreenshare(groupCall)).toBe(false);
  });

  it('allows local share start when nobody else is presenting', () => {
    const groupCall = {
      isScreensharing: () => false,
      screenshareFeeds: [],
    } as never;
    expect(isRemoteScreenshareActive(groupCall)).toBe(false);
    expect(canStartLocalScreenshare(groupCall)).toBe(true);
  });
});
