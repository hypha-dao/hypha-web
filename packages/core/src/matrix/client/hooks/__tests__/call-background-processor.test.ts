import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalVideoTrack } from 'livekit-client';

type FakeProcessor = {
  name: string;
  options: Record<string, unknown>;
  destroy: ReturnType<typeof vi.fn>;
  switchTo: ReturnType<typeof vi.fn>;
};
const created: FakeProcessor[] = [];
let switchToImpl: (mode: unknown) => Promise<void> = async () => undefined;

vi.mock('@livekit/track-processors', () => ({
  supportsBackgroundProcessors: () => true,
  BackgroundProcessor: (options: Record<string, unknown>, name: string) => {
    const processor: FakeProcessor = {
      name,
      options,
      destroy: vi.fn(async () => undefined),
      switchTo: vi.fn((mode: unknown) => switchToImpl(mode)),
    };
    created.push(processor);
    return processor;
  },
}));

import {
  attachCallBackgroundProcessor,
  CallBackgroundImageError,
  recoverCameraWithoutProcessor,
  switchCallBackgroundEffect,
} from '../call-background-processor';

const BLUR = { mode: 'background-blur', blurRadius: 10 } as const;
const IMAGE = { mode: 'virtual-background', imagePath: '/x.jpg' } as const;

/** `new Image()` whose decode() the test controls (core tests run without a DOM). */
let decodeImpl: () => Promise<void> = async () => undefined;
class FakeImage {
  crossOrigin = '';
  src = '';
  decode() {
    return decodeImpl();
  }
}

function fakeTrack() {
  let processor: unknown;
  const track = {
    setProcessor: vi.fn(async (p: unknown) => {
      processor = p;
    }),
    getProcessor: vi.fn(() => processor),
    stopProcessor: vi.fn(async () => {
      processor = undefined;
    }),
    setRegistered(p: unknown) {
      processor = p;
    },
  };
  return track;
}

beforeEach(() => {
  created.length = 0;
  switchToImpl = async () => undefined;
  decodeImpl = async () => undefined;
  vi.stubGlobal('Image', FakeImage);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('attachCallBackgroundProcessor', () => {
  it('attaches when the request is still current', async () => {
    const track = fakeTrack();
    await expect(
      attachCallBackgroundProcessor(track as unknown as LocalVideoTrack, BLUR),
    ).resolves.toBe(true);
    expect(track.setProcessor).toHaveBeenCalledTimes(1);
  });

  it('starts an image effect in strong blur, then switches to the image', async () => {
    // Regression: 0.8.3 only logs an image failing during init and then passes the room through.
    const track = fakeTrack();
    await attachCallBackgroundProcessor(
      track as unknown as LocalVideoTrack,
      IMAGE,
    );
    expect(created[0]!.options).toMatchObject({ mode: 'background-blur' });
    expect(created[0]!.switchTo).toHaveBeenCalledWith(IMAGE);
  });

  it('reports an image the processor cannot apply as an image error', async () => {
    switchToImpl = async () => {
      throw new Error('createImageBitmap failed');
    };
    const track = fakeTrack();
    await expect(
      attachCallBackgroundProcessor(track as unknown as LocalVideoTrack, IMAGE),
    ).rejects.toBeInstanceOf(CallBackgroundImageError);
  });

  it('does not attach when a newer choice arrived while the package loaded', async () => {
    const track = fakeTrack();
    let checks = 0;
    const shouldCommit = () => {
      checks += 1;
      return checks === 1; // current before loading, superseded after
    };
    await expect(
      attachCallBackgroundProcessor(
        track as unknown as LocalVideoTrack,
        BLUR,
        {},
        shouldCommit,
      ),
    ).resolves.toBe(false);
    expect(track.setProcessor).not.toHaveBeenCalled();
    expect(created[0]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('lets a newer choice release a stalled image load', async () => {
    vi.useFakeTimers();
    decodeImpl = () => new Promise<void>(() => undefined); // never loads
    let current = true;
    const track = fakeTrack();
    const result = attachCallBackgroundProcessor(
      track as unknown as LocalVideoTrack,
      IMAGE,
      {},
      () => current,
    );
    current = false;
    await vi.advanceTimersByTimeAsync(200);
    await expect(result).resolves.toBe(false);
    expect(track.setProcessor).not.toHaveBeenCalled();
  });

  it('treats an image that never loads as broken after the deadline', async () => {
    vi.useFakeTimers();
    decodeImpl = () => new Promise<void>(() => undefined);
    const track = fakeTrack();
    const result = attachCallBackgroundProcessor(
      track as unknown as LocalVideoTrack,
      IMAGE,
    );
    const assertion = expect(result).rejects.toBeInstanceOf(
      CallBackgroundImageError,
    );
    await vi.advanceTimersByTimeAsync(16_000);
    await assertion;
  });

  it.each(['resolves', 'rejects'] as const)(
    'removes a start that %s after the deadline if it is still on the track',
    async (outcome) => {
      vi.useFakeTimers();
      let settle!: () => void;
      const track = fakeTrack();
      track.setProcessor.mockImplementation(
        (p: unknown) =>
          new Promise<void>((resolve, reject) => {
            settle = () => {
              track.setRegistered(p); // livekit registers before swapping the sender
              if (outcome === 'resolves') resolve();
              else reject(new Error('replaceTrack failed'));
            };
          }),
      );
      const onLateStartRemoved = vi.fn();
      const result = attachCallBackgroundProcessor(
        track as unknown as LocalVideoTrack,
        BLUR,
        { onLateStartRemoved },
      );
      const assertion = expect(result).rejects.toThrow(/did not start/);
      await vi.advanceTimersByTimeAsync(20_001);
      await assertion;
      settle();
      await vi.advanceTimersByTimeAsync(0);
      expect(track.stopProcessor).toHaveBeenCalledTimes(1);
      expect(onLateStartRemoved).toHaveBeenCalledTimes(1);
    },
  );

  it('releases a late start that never registered, without touching the track', async () => {
    vi.useFakeTimers();
    let fail!: () => void;
    const track = fakeTrack();
    track.setProcessor.mockImplementation(
      () =>
        new Promise<void>((_, reject) => {
          fail = () => reject(new Error('init failed'));
        }),
    );
    const result = attachCallBackgroundProcessor(
      track as unknown as LocalVideoTrack,
      BLUR,
    );
    const assertion = expect(result).rejects.toThrow(/did not start/);
    await vi.advanceTimersByTimeAsync(20_001);
    await assertion;
    fail();
    await vi.advanceTimersByTimeAsync(0);
    expect(track.stopProcessor).not.toHaveBeenCalled();
    expect(created[0]!.destroy).toHaveBeenCalled();
  });
});

describe('switchCallBackgroundEffect', () => {
  it('reports a failed image switch as an image error', async () => {
    const track = fakeTrack();
    await attachCallBackgroundProcessor(
      track as unknown as LocalVideoTrack,
      BLUR,
    );
    switchToImpl = async () => {
      throw new Error('blob revoked');
    };
    await expect(
      switchCallBackgroundEffect(track as unknown as LocalVideoTrack, IMAGE),
    ).rejects.toBeInstanceOf(CallBackgroundImageError);
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
   * capture; a mute stops the track's own capture.
   */
  function failedRestartState() {
    const previous = capture(false);
    const orphan = capture(true);
    const captures: FakeCapture[] = [previous, orphan];
    let own = previous;
    let cameraOn = false;
    const track = {
      mediaStream: stream(orphan) as { getVideoTracks: () => FakeCapture[] },
      stopProcessor: vi.fn(async () => {
        track.mediaStream = stream(own);
      }),
    };
    const participant = {
      setCameraEnabled: vi.fn(async (enabled: boolean) => {
        cameraOn = enabled;
        if (enabled) {
          own = capture(true);
          captures.push(own);
          track.mediaStream = stream(own);
        } else {
          own.stop();
        }
      }),
    };
    return {
      track,
      participant,
      captures,
      orphan,
      get cameraOn() {
        return cameraOn;
      },
    };
  }

  it('stops the orphaned capture although stopProcessor replaces the stream', async () => {
    const state = failedRestartState();
    await expect(
      recoverCameraWithoutProcessor(
        state.participant,
        state.track as unknown as LocalVideoTrack,
      ),
    ).resolves.toBe(true);
    expect(state.orphan.readyState).toBe('ended');
    expect(state.cameraOn).toBe(true);
  });

  it('leaves no capture running after a later mute', async () => {
    const state = failedRestartState();
    await recoverCameraWithoutProcessor(
      state.participant,
      state.track as unknown as LocalVideoTrack,
    );
    await state.participant.setCameraEnabled(false);
    expect(state.captures.every((c) => c.readyState === 'ended')).toBe(true);
  });

  it('does not turn the camera on when a newer mute came in', async () => {
    // Regression: the recovery's camera-on overrode a mute requested meanwhile.
    const state = failedRestartState();
    await expect(
      recoverCameraWithoutProcessor(
        state.participant,
        state.track as unknown as LocalVideoTrack,
        () => false,
      ),
    ).resolves.toBe(false);
    expect(state.orphan.readyState).toBe('ended'); // cleanup stays unconditional
    expect(state.participant.setCameraEnabled).not.toHaveBeenCalled();
  });

  it('turns the camera off again when a mute lands during the camera-on', async () => {
    const state = failedRestartState();
    let current = true;
    state.participant.setCameraEnabled.mockImplementationOnce(async () => {
      current = false; // the mute completed meanwhile
    });
    await expect(
      recoverCameraWithoutProcessor(
        state.participant,
        state.track as unknown as LocalVideoTrack,
        () => current,
      ),
    ).resolves.toBe(false);
    expect(state.participant.setCameraEnabled).toHaveBeenLastCalledWith(false);
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
