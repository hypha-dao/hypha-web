import { describe, expect, it, vi } from 'vitest';
import type { LocalVideoTrack } from 'livekit-client';

const destroy = vi.fn(async () => undefined);
vi.mock('@livekit/track-processors', () => ({
  supportsBackgroundProcessors: () => true,
  BackgroundProcessor: () => ({ name: 'hypha-background-effect', destroy }),
}));

import {
  attachCallBackgroundProcessor,
  recoverCameraWithoutProcessor,
} from '../call-background-processor';

const BLUR = { mode: 'background-blur', blurRadius: 10 } as const;

function fakeTrack() {
  return {
    setProcessor: vi.fn(async () => undefined),
    getProcessor: vi.fn(() => undefined),
    stopProcessor: vi.fn(async () => undefined),
  } as unknown as LocalVideoTrack & {
    setProcessor: ReturnType<typeof vi.fn>;
  };
}

describe('attachCallBackgroundProcessor', () => {
  it('attaches when the request is still current', async () => {
    const track = fakeTrack();
    await expect(attachCallBackgroundProcessor(track, BLUR)).resolves.toBe(
      true,
    );
    expect(track.setProcessor).toHaveBeenCalledTimes(1);
  });

  it('does not attach when a newer choice arrived while the package loaded', async () => {
    // Regression: the commit check ran only before `createProcessor`.
    destroy.mockClear();
    const track = fakeTrack();
    let checks = 0;
    const shouldCommit = () => {
      checks += 1;
      return checks === 1; // current before loading, superseded after
    };
    await expect(
      attachCallBackgroundProcessor(track, BLUR, {}, shouldCommit),
    ).resolves.toBe(false);
    expect(track.setProcessor).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});

describe('recoverCameraWithoutProcessor', () => {
  type FakeCapture = { readyState: 'live' | 'ended'; stop: () => void };
  function capture(live = true): FakeCapture {
    const c: FakeCapture = {
      readyState: live ? 'live' : 'ended',
      stop: () => {
        c.readyState = 'ended';
      },
    };
    return c;
  }
  const stream = (...tracks: FakeCapture[]) => ({
    getVideoTracks: () => tracks,
  });

  /**
   * Models livekit-client 2.20.0 after a failed processor restart on unmute: `restart()` stopped
   * the previous capture and left the new one orphaned in `mediaStream`; `stopProcessor()`
   * replaces `mediaStream` with the previous track; `setCameraEnabled(true)` acquires a fresh
   * capture; a later mute stops the track's own capture.
   */
  function failedRestartState() {
    const previous = capture(false);
    const orphan = capture(true);
    const captures: FakeCapture[] = [previous, orphan];
    let own = previous;
    const track = {
      mediaStream: stream(orphan) as { getVideoTracks: () => FakeCapture[] },
      stopProcessor: vi.fn(async () => {
        track.mediaStream = stream(own);
      }),
    };
    const participant = {
      setCameraEnabled: vi.fn(async (enabled: boolean) => {
        if (enabled) {
          own = capture(true);
          captures.push(own);
          track.mediaStream = stream(own);
        } else {
          own.stop();
        }
      }),
    };
    return { track, participant, captures, orphan };
  }

  it('stops the orphaned capture although stopProcessor replaces the stream', async () => {
    // Regressions: livekit-client never stops the capture of a failed restart, and reading
    // `mediaStream` after `stopProcessor()` would only see the previous track.
    const { track, participant, orphan } = failedRestartState();
    await recoverCameraWithoutProcessor(
      participant,
      track as unknown as LocalVideoTrack,
    );
    expect(track.stopProcessor).toHaveBeenCalledTimes(1);
    expect(orphan.readyState).toBe('ended');
    expect(participant.setCameraEnabled).toHaveBeenCalledWith(true);
  });

  it('leaves no capture running after a later mute', async () => {
    const { track, participant, captures } = failedRestartState();
    await recoverCameraWithoutProcessor(
      participant,
      track as unknown as LocalVideoTrack,
    );
    await participant.setCameraEnabled(false);
    expect(captures.every((c) => c.readyState === 'ended')).toBe(true);
  });

  it('copes with no stream and a failing stopProcessor', async () => {
    const participant = { setCameraEnabled: vi.fn(async () => undefined) };
    await recoverCameraWithoutProcessor(participant, {
      stopProcessor: vi.fn(async () => {
        throw new Error('already stopped');
      }),
      mediaStream: undefined,
    } as unknown as LocalVideoTrack);
    expect(participant.setCameraEnabled).toHaveBeenCalledWith(true);
  });
});
