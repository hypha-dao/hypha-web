import { describe, expect, it, vi } from 'vitest';
import type { Room } from 'livekit-client';

import {
  buildScreenShareCaptureOptions,
  buildScreenSharePublishOptions,
  publishScreenShare,
  screenShareCopyHeights,
} from '../screenshare-publish-settings';

describe('screenShareCopyHeights', () => {
  it('above 1080p: 1080p and 540p', () => {
    expect(screenShareCopyHeights(1440)).toEqual([540, 1080]);
    expect(screenShareCopyHeights(2160)).toEqual([540, 1080]);
  });

  it('1080p or smaller: 720p and 360p', () => {
    expect(screenShareCopyHeights(1080)).toEqual([360, 720]);
    // A 1200p screen is not "above 1080p" enough for a separate 1080p copy.
    expect(screenShareCopyHeights(1200)).toEqual([360, 720]);
  });

  it('drops copies that are not clearly smaller than the share', () => {
    expect(screenShareCopyHeights(720)).toEqual([360]);
    expect(screenShareCopyHeights(380)).toEqual([]);
  });

  it('keeps 720p and 360p when the size is unknown', () => {
    expect(screenShareCopyHeights()).toEqual([360, 720]);
  });
});

describe('screenshare options', () => {
  it('captures up to 1440p for detail', () => {
    expect(buildScreenShareCaptureOptions()).toEqual({
      contentHint: 'detail',
      resolution: { width: 2560, height: 1440, frameRate: 30 },
    });
  });

  it('sends VP8 at 15 fps and up to 4 Mbps, copies by shared size', () => {
    const publish = buildScreenSharePublishOptions({
      width: 2560,
      height: 1440,
    });
    expect(publish).toMatchObject({
      simulcast: true,
      videoCodec: 'vp8',
      screenShareEncoding: { maxBitrate: 4_000_000, maxFramerate: 15 },
      degradationPreference: 'maintain-resolution',
    });
    expect(publish.screenShareSimulcastLayers?.map((p) => p.height)).toEqual([
      540, 1080,
    ]);
    expect(
      buildScreenSharePublishOptions({
        width: 1920,
        height: 1080,
      }).screenShareSimulcastLayers?.map((p) => p.height),
    ).toEqual([360, 720]);
  });
});

describe('publishScreenShare', () => {
  it('keeps an existing share instead of capturing a second one', async () => {
    const unmute = vi.fn().mockResolvedValue(undefined);
    const createScreenTracks = vi.fn();
    const room = {
      localParticipant: {
        getTrackPublication: () => ({
          track: { mediaStreamTrack: { readyState: 'live' } },
          isMuted: true,
          unmute,
        }),
        createScreenTracks,
        publishTrack: vi.fn(),
      },
    } as unknown as Room;
    await publishScreenShare(room);
    expect(createScreenTracks).not.toHaveBeenCalled();
    expect(unmute).toHaveBeenCalledOnce();
  });

  it('unpublishes what went live when a later track fails, then rethrows', async () => {
    const video = {
      source: 'screen_share',
      mediaStreamTrack: { getSettings: () => ({ width: 1920, height: 1080 }) },
      stop: vi.fn(),
    };
    const audio = { source: 'screen_share_audio', stop: vi.fn() };
    const published = new Map<string, unknown>();
    const unpublishTrack = vi.fn().mockResolvedValue(undefined);
    const room = {
      localParticipant: {
        getTrackPublication: (source: string) => published.get(source),
        createScreenTracks: vi.fn().mockResolvedValue([video, audio]),
        publishTrack: vi.fn((t: { source: string }) => {
          if (t === audio) return Promise.reject(new Error('audio failed'));
          published.set(t.source, { track: t });
          return Promise.resolve();
        }),
        unpublishTrack,
      },
    } as unknown as Room;
    await expect(publishScreenShare(room)).rejects.toThrow('audio failed');
    expect(unpublishTrack).toHaveBeenCalledWith(video);
    expect(unpublishTrack).not.toHaveBeenCalledWith(audio);
    expect(video.stop).toHaveBeenCalled();
    expect(audio.stop).toHaveBeenCalled();
  });

  it('clears a publication whose track already ended and captures again', async () => {
    const ended = { mediaStreamTrack: { readyState: 'ended' } };
    let current: unknown = { track: ended, isMuted: false };
    const video = {
      source: 'screen_share',
      mediaStreamTrack: { getSettings: () => ({ width: 1920, height: 1080 }) },
      stop: vi.fn(),
    };
    const createScreenTracks = vi.fn().mockResolvedValue([video]);
    const unpublishTrack = vi.fn(async () => {
      current = undefined;
    });
    const room = {
      localParticipant: {
        getTrackPublication: () => current,
        createScreenTracks,
        publishTrack: vi.fn().mockResolvedValue(undefined),
        unpublishTrack,
      },
    } as unknown as Room;
    await publishScreenShare(room);
    expect(unpublishTrack).toHaveBeenCalledWith(ended);
    expect(createScreenTracks).toHaveBeenCalledOnce();
  });
});
