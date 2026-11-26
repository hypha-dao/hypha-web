import { describe, expect, it } from 'vitest';
import { ScreenSharePresets } from 'livekit-client';

import {
  DEFAULT_SCREEN_SHARE_PUBLISH_SETTINGS,
  buildScreenShareOptions,
  normalizeScreenSharePublishSettings,
} from '../screenshare-publish-settings';

describe('buildScreenShareOptions', () => {
  it('defaults: up to 1440p, 15 fps at 4 Mbps, 360p + 720p copies, VP8, detail', () => {
    const { capture, publish } = buildScreenShareOptions(
      DEFAULT_SCREEN_SHARE_PUBLISH_SETTINGS,
    );
    expect(capture).toEqual({
      contentHint: 'detail',
      resolution: { width: 2560, height: 1440, frameRate: 30 },
    });
    expect(publish).toMatchObject({
      simulcast: true,
      videoCodec: 'vp8',
      screenShareEncoding: { maxBitrate: 4_000_000, maxFramerate: 15 },
      screenShareSimulcastLayers: [
        ScreenSharePresets.h360fps15,
        ScreenSharePresets.h720fps15,
      ],
      degradationPreference: 'maintain-resolution',
    });
  });

  it('maps each choice', () => {
    const { capture, publish } = buildScreenShareOptions({
      maxSize: 'native',
      frameRate: 30,
      bitrateMbps: 2.5,
      layers: '360p',
      codec: 'vp9',
    });
    expect(capture.resolution).toEqual({ width: 0, height: 0, frameRate: 30 });
    expect(publish.videoCodec).toBe('vp9');
    expect(publish.screenShareEncoding).toEqual({
      maxBitrate: 2_500_000,
      maxFramerate: 30,
    });
    expect(publish.screenShareSimulcastLayers).toEqual([
      ScreenSharePresets.h360fps15,
    ]);
  });
});

describe('normalizeScreenSharePublishSettings', () => {
  it('keeps known values and falls back per field', () => {
    expect(
      normalizeScreenSharePublishSettings({
        maxSize: '1080p',
        frameRate: 60,
        codec: 'h265',
        bitrateMbps: 8,
      }),
    ).toEqual({
      ...DEFAULT_SCREEN_SHARE_PUBLISH_SETTINGS,
      maxSize: '1080p',
      bitrateMbps: 8,
    });
    expect(normalizeScreenSharePublishSettings('junk')).toEqual(
      DEFAULT_SCREEN_SHARE_PUBLISH_SETTINGS,
    );
  });
});
