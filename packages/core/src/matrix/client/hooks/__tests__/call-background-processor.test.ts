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
  function capture(live = true) {
    return { readyState: live ? 'live' : 'ended', stop: vi.fn() };
  }

  it('stops the capture left by the failed restart, then turns the camera on', async () => {
    // Regression: livekit-client does not stop the new capture when the processor restart throws,
    // so it would keep running after a later mute.
    const previous = capture(false);
    const orphan = capture(true);
    const order: string[] = [];
    orphan.stop.mockImplementation(() => order.push('stop-orphan'));
    const track = {
      stopProcessor: vi.fn(async () => {
        order.push('stop-processor');
      }),
      mediaStreamTrack: previous,
      mediaStream: { getVideoTracks: () => [previous, orphan] },
    };
    const participant = {
      setCameraEnabled: vi.fn(async () => {
        order.push('camera-on');
      }),
    };
    await recoverCameraWithoutProcessor(
      participant,
      track as unknown as LocalVideoTrack,
    );
    expect(orphan.stop).toHaveBeenCalledTimes(1);
    expect(previous.stop).not.toHaveBeenCalled();
    expect(order).toEqual(['stop-processor', 'stop-orphan', 'camera-on']);
    expect(participant.setCameraEnabled).toHaveBeenCalledWith(true);
  });

  it('copes with no stream and a failing stopProcessor', async () => {
    const participant = { setCameraEnabled: vi.fn(async () => undefined) };
    await recoverCameraWithoutProcessor(participant, {
      stopProcessor: vi.fn(async () => {
        throw new Error('already stopped');
      }),
      mediaStream: undefined,
      mediaStreamTrack: capture(true),
    } as unknown as LocalVideoTrack);
    expect(participant.setCameraEnabled).toHaveBeenCalledWith(true);
  });
});
