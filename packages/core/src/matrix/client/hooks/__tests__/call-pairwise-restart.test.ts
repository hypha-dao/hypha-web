import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  countActivePairwiseCalls,
  hangupAllActivePairwiseCalls,
  hangupPairwiseCallsForRemoteUsers,
  hasActivePairwiseCalls,
  republishLocalMediaToPairwiseCalls,
  resetPairwiseRepublishFingerprintForTests,
  resetPairwiseVideoResyncScheduleForTests,
  restartAllPairwiseCallsForVideo,
  schedulePairwiseVideoResync,
  waitForActivePairwiseCalls,
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

describe('pairwise video resync', () => {
  afterEach(() => {
    resetPairwiseVideoResyncScheduleForTests();
    vi.useRealTimers();
  });

  it('detects active pairwise calls', () => {
    const gc = {
      forEachCall: (callback: (call: unknown) => void) => {
        callback({ callHasEnded: () => true });
        callback({ callHasEnded: () => false });
      },
    };
    expect(hasActivePairwiseCalls(gc)).toBe(true);
    expect(countActivePairwiseCalls(gc)).toBe(1);
  });

  it('waits until new pairwise calls appear after hangup', async () => {
    vi.useFakeTimers();
    let active = false;
    const gc = {
      forEachCall: (callback: (call: unknown) => void) => {
        if (active) {
          callback({ callHasEnded: () => false });
        }
      },
    };
    const pending = waitForActivePairwiseCalls(gc, {
      timeoutMs: 2_000,
      pollMs: 200,
    });
    await vi.advanceTimersByTimeAsync(199);
    expect(countActivePairwiseCalls(gc)).toBe(0);
    active = true;
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe(true);
    vi.useRealTimers();
  });

  it('hangs up all active pairwise calls', () => {
    const hangup = vi.fn();
    const gc = {
      forEachCall: (callback: (call: unknown) => void) => {
        callback({ callHasEnded: () => false, hangup });
      },
    };
    expect(hangupAllActivePairwiseCalls(gc)).toBe(1);
    expect(hangup).toHaveBeenCalledTimes(1);
  });

  it('schedules a debounced full video resync', async () => {
    vi.useFakeTimers();
    const hangup = vi.fn();
    const update = vi.fn().mockResolvedValue(undefined);
    const nudge = vi.fn();
    const track = {
      kind: 'video',
      id: 'v1',
      readyState: 'live',
      muted: false,
      enabled: true,
    } as MediaStreamTrack;
    const gc = {
      groupCallId: 'gc-test-1',
      localCallFeed: {
        stream: { id: 's1', getTracks: () => [track] } as MediaStream,
        isVideoMuted: () => false,
        isAudioMuted: () => false,
      },
      forEachCall: (callback: (call: unknown) => void) => {
        callback({
          callHasEnded: () => false,
          hangup,
          isLocalVideoMuted: () => false,
          hasUserMediaVideoSender: true,
          updateLocalUsermediaStream: update,
        });
      },
    };

    schedulePairwiseVideoResync(gc, nudge, 100);
    await vi.advanceTimersByTimeAsync(100);

    expect(hangup).toHaveBeenCalledTimes(1);
    expect(nudge).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(gc.localCallFeed.stream, true, true);
  });

  it('caps full video resync to two attempts per group call', async () => {
    vi.useFakeTimers();
    const hangup = vi.fn();
    const nudge = vi.fn();
    const gc = {
      groupCallId: 'gc-cap-test',
      localCallFeed: { stream: null },
      forEachCall: (callback: (call: unknown) => void) => {
        callback({ callHasEnded: () => false, hangup });
      },
    };

    schedulePairwiseVideoResync(gc, nudge, 50);
    await vi.advanceTimersByTimeAsync(50);
    schedulePairwiseVideoResync(gc, nudge, 50);
    await vi.advanceTimersByTimeAsync(50);
    schedulePairwiseVideoResync(gc, nudge, 50);
    await vi.advanceTimersByTimeAsync(50);

    expect(hangup).toHaveBeenCalledTimes(2);
  });

  it('restartAllPairwiseCallsForVideo hangs up, nudges, and republishes', async () => {
    const hangup = vi.fn();
    const update = vi.fn().mockResolvedValue(undefined);
    const nudge = vi.fn();
    const track = {
      kind: 'video',
      id: 'v1',
      readyState: 'live',
      muted: false,
      enabled: true,
    } as MediaStreamTrack;
    const gc = {
      localCallFeed: {
        stream: { id: 's1', getTracks: () => [track] } as MediaStream,
        isVideoMuted: () => false,
        isAudioMuted: () => false,
      },
      forEachCall: (callback: (call: unknown) => void) => {
        callback({
          callHasEnded: () => false,
          hangup,
          isLocalVideoMuted: () => false,
          hasUserMediaVideoSender: true,
          updateLocalUsermediaStream: update,
        });
      },
    };

    await expect(restartAllPairwiseCallsForVideo(gc, nudge)).resolves.toBe(1);
    expect(hangup).toHaveBeenCalledTimes(1);
    expect(nudge).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe('republishLocalMediaToPairwiseCalls', () => {
  beforeEach(() => {
    resetPairwiseRepublishFingerprintForTests();
  });

  it('pushes the local feed stream into each active MatrixCall with force A/V flags', async () => {
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
      localCallFeed: {
        stream,
        isVideoMuted: () => false,
        isAudioMuted: () => false,
      },
      forEachCall: (callback: (call: unknown) => void) => {
        callback({
          callHasEnded: () => false,
          isLocalVideoMuted: () => false,
          hasUserMediaVideoSender: true,
          updateLocalUsermediaStream: update,
        });
      },
    };

    await expect(republishLocalMediaToPairwiseCalls(gc)).resolves.toBe(1);
    expect(update).toHaveBeenCalledWith(stream, true, true);
  });

  it('forces video publish when the pairwise call feed still reports video muted', async () => {
    const audioTrack = {
      kind: 'audio',
      id: 'a1',
      readyState: 'live',
      muted: false,
      enabled: true,
    } as MediaStreamTrack;
    const videoTrack = {
      kind: 'video',
      id: 'v1',
      readyState: 'live',
      muted: false,
      enabled: true,
    } as MediaStreamTrack;
    const stream = {
      id: 'local-stream',
      getTracks: () => [audioTrack, videoTrack],
    } as MediaStream;
    const update = vi.fn().mockResolvedValue(undefined);
    const setLocalVideoMuted = vi.fn().mockResolvedValue(true);
    const setAudioVideoMuted = vi.fn();
    const gc = {
      localCallFeed: {
        stream,
        isVideoMuted: () => false,
        isAudioMuted: () => false,
      },
      forEachCall: (callback: (call: unknown) => void) => {
        callback({
          callHasEnded: () => false,
          isLocalVideoMuted: () => true,
          hasUserMediaVideoSender: true,
          localUsermediaFeed: { setAudioVideoMuted },
          setLocalVideoMuted,
          updateLocalUsermediaStream: update,
        });
      },
    };

    await republishLocalMediaToPairwiseCalls(gc);

    expect(setLocalVideoMuted).toHaveBeenCalledWith(false);
    expect(setAudioVideoMuted).toHaveBeenCalledWith(false, false);
    expect(update).toHaveBeenCalledWith(stream, true, true);
  });

  it('upgrades audio-first pairwise calls that lack a video sender', async () => {
    const videoTrack = {
      kind: 'video',
      id: 'v1',
      readyState: 'live',
      muted: false,
      enabled: true,
    } as MediaStreamTrack;
    const stream = {
      id: 'local-stream',
      getTracks: () => [videoTrack],
    } as MediaStream;
    const setLocalVideoMuted = vi.fn().mockResolvedValue(true);
    const update = vi.fn().mockResolvedValue(undefined);
    const gc = {
      localCallFeed: {
        stream,
        isVideoMuted: () => false,
        isAudioMuted: () => false,
      },
      forEachCall: (callback: (call: unknown) => void) => {
        callback({
          callHasEnded: () => false,
          isLocalVideoMuted: () => true,
          hasUserMediaVideoSender: false,
          setLocalVideoMuted,
          updateLocalUsermediaStream: update,
        });
      },
    };

    await republishLocalMediaToPairwiseCalls(gc);

    expect(setLocalVideoMuted).toHaveBeenCalledWith(false);
    expect(update).toHaveBeenCalledWith(stream, true, true);
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
      isLocalVideoMuted: () => false,
      hasUserMediaVideoSender: true,
      updateLocalUsermediaStream: update,
    };
    const gc = {
      localCallFeed: {
        stream,
        isVideoMuted: () => false,
        isAudioMuted: () => false,
      },
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
      isLocalVideoMuted: () => false,
      hasUserMediaVideoSender: true,
      updateLocalUsermediaStream: updateA,
    };
    const callB = {
      callHasEnded: () => false,
      isLocalVideoMuted: () => false,
      hasUserMediaVideoSender: true,
      updateLocalUsermediaStream: updateB,
    };
    const gc = {
      localCallFeed: {
        stream,
        isVideoMuted: () => false,
        isAudioMuted: () => false,
      },
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
      isLocalVideoMuted: () => false,
      hasUserMediaVideoSender: true,
      updateLocalUsermediaStream: update,
    };
    const gc = {
      localCallFeed: {
        stream,
        isVideoMuted: () => false,
        isAudioMuted: () => false,
      },
      forEachCall: (callback: (call: unknown) => void) => {
        callback(call);
      },
    };

    await republishLocalMediaToPairwiseCalls(gc);
    Object.defineProperty(track, 'muted', { value: false, writable: true });
    await expect(republishLocalMediaToPairwiseCalls(gc)).resolves.toBe(1);
    expect(update).toHaveBeenCalledTimes(2);
  });
});
