import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hangupPairwiseCallsForRemoteUsers,
  republishLocalMediaToPairwiseCalls,
  resetPairwiseRepublishFingerprintForTests,
} from '../call-pairwise-restart';

describe('hangupPairwiseCallsForRemoteUsers', () => {
  it('hangs up calls whose opponent matches a target user id', () => {
    const hangupA = vi.fn();
    const hangupB = vi.fn();
    const gc = {
      forEachCall: (callback: (call: unknown) => void) => {
        callback({
          getOpponentMember: () => ({ userId: '@a:hs' }),
          callHasEnded: () => false,
          hangup: hangupA,
        });
        callback({
          getOpponentMember: () => ({ userId: '@b:hs' }),
          callHasEnded: () => false,
          hangup: hangupB,
        });
      },
    };

    expect(hangupPairwiseCallsForRemoteUsers(gc, ['@a:hs'])).toBe(1);
    expect(hangupA).toHaveBeenCalledTimes(1);
    expect(hangupB).not.toHaveBeenCalled();
  });

  it('skips calls that already ended', () => {
    const hangup = vi.fn();
    const gc = {
      forEachCall: (callback: (call: unknown) => void) => {
        callback({
          getOpponentMember: () => ({ userId: '@a:hs' }),
          callHasEnded: () => true,
          hangup,
        });
      },
    };

    expect(hangupPairwiseCallsForRemoteUsers(gc, ['@a:hs'])).toBe(0);
    expect(hangup).not.toHaveBeenCalled();
  });
});

describe('republishLocalMediaToPairwiseCalls', () => {
  beforeEach(() => {
    resetPairwiseRepublishFingerprintForTests();
  });

  it('pushes the local feed stream into each active MatrixCall', async () => {
    const track = {
      kind: 'video',
      id: 'v1',
      readyState: 'live',
      muted: false,
      enabled: true,
    } as MediaStreamTrack;
    const stream = {
      id: 'local-stream',
      getTracks: () => [track],
    } as MediaStream;
    const update = vi.fn().mockResolvedValue(undefined);
    const gc = {
      localCallFeed: { stream },
      forEachCall: (callback: (call: unknown) => void) => {
        callback({
          callHasEnded: () => false,
          updateLocalUsermediaStream: update,
        });
      },
    };

    await expect(republishLocalMediaToPairwiseCalls(gc)).resolves.toBe(1);
    expect(update).toHaveBeenCalledWith(stream);
  });

  it('skips duplicate republish for the same call and stream fingerprint', async () => {
    const track = {
      kind: 'video',
      id: 'v1',
      readyState: 'live',
      muted: false,
      enabled: true,
    } as MediaStreamTrack;
    const stream = {
      id: 'local-stream',
      getTracks: () => [track],
    } as MediaStream;
    const update = vi.fn().mockResolvedValue(undefined);
    const call = {
      callHasEnded: () => false,
      updateLocalUsermediaStream: update,
    };
    const gc = {
      localCallFeed: { stream },
      forEachCall: (callback: (call: unknown) => void) => {
        callback(call);
      },
    };

    await republishLocalMediaToPairwiseCalls(gc);
    await expect(republishLocalMediaToPairwiseCalls(gc)).resolves.toBe(0);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('republishes when a new pairwise call appears with the same stream', async () => {
    const track = {
      kind: 'video',
      id: 'v1',
      readyState: 'live',
      muted: false,
      enabled: true,
    } as MediaStreamTrack;
    const stream = {
      id: 'local-stream',
      getTracks: () => [track],
    } as MediaStream;
    const updateA = vi.fn().mockResolvedValue(undefined);
    const updateB = vi.fn().mockResolvedValue(undefined);
    const callA = {
      callHasEnded: () => false,
      updateLocalUsermediaStream: updateA,
    };
    const callB = {
      callHasEnded: () => false,
      updateLocalUsermediaStream: updateB,
    };
    const gc = {
      localCallFeed: { stream },
      forEachCall: (callback: (call: unknown) => void) => {
        callback(callA);
      },
    };

    await republishLocalMediaToPairwiseCalls(gc);
    gc.forEachCall = (callback: (call: unknown) => void) => {
      callback(callA);
      callback(callB);
    };
    await expect(republishLocalMediaToPairwiseCalls(gc)).resolves.toBe(1);
    expect(updateA).toHaveBeenCalledTimes(1);
    expect(updateB).toHaveBeenCalledTimes(1);
  });

  it('republishes when a warmed camera track unmutes', async () => {
    const track = {
      kind: 'video',
      id: 'v1',
      readyState: 'live',
      muted: true,
      enabled: true,
    } as MediaStreamTrack;
    const stream = {
      id: 'local-stream',
      getTracks: () => [track],
    } as MediaStream;
    const update = vi.fn().mockResolvedValue(undefined);
    const call = {
      callHasEnded: () => false,
      updateLocalUsermediaStream: update,
    };
    const gc = {
      localCallFeed: { stream },
      forEachCall: (callback: (call: unknown) => void) => {
        callback(call);
      },
    };

    await republishLocalMediaToPairwiseCalls(gc);
    track.muted = false;
    await expect(republishLocalMediaToPairwiseCalls(gc)).resolves.toBe(1);
    expect(update).toHaveBeenCalledTimes(2);
  });
});
