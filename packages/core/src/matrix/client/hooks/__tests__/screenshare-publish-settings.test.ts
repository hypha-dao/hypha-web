import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SCREEN_SHARE_PUBLISH_SETTINGS,
  buildScreenShareCaptureOptions,
  buildScreenSharePublishOptions,
  normalizeScreenSharePublishSettings,
  screenShareCopyHeights,
} from '../screenshare-publish-settings';

const copies = (
  publish: ReturnType<typeof buildScreenSharePublishOptions>,
): number[] => (publish.screenShareSimulcastLayers ?? []).map((p) => p.height);

describe('screenShareCopyHeights (auto)', () => {
  it('above 1080p: 1080p and 540p', () => {
    expect(screenShareCopyHeights('auto', 1440)).toEqual([540, 1080]);
    expect(screenShareCopyHeights('auto', 2160)).toEqual([540, 1080]);
  });

  it('1080p or smaller: 720p and 360p', () => {
    expect(screenShareCopyHeights('auto', 1080)).toEqual([360, 720]);
    // A 1200p screen is not "above 1080p" enough for a separate 1080p copy.
    expect(screenShareCopyHeights('auto', 1200)).toEqual([360, 720]);
  });

  it('drops copies that are not clearly smaller than the share', () => {
    expect(screenShareCopyHeights('auto', 720)).toEqual([360]);
    expect(screenShareCopyHeights('auto', 380)).toEqual([]);
    expect(screenShareCopyHeights('720p+1080p', 1080)).toEqual([720]);
  });

  it('keeps the list when the size is unknown', () => {
    expect(screenShareCopyHeights('auto')).toEqual([360, 720]);
    expect(screenShareCopyHeights('540p+1080p')).toEqual([540, 1080]);
  });
});

describe('buildScreenShare*Options', () => {
  it('defaults: up to 1440p, 15 fps at 4 Mbps, VP8, detail, copies by size', () => {
    expect(
      buildScreenShareCaptureOptions(DEFAULT_SCREEN_SHARE_PUBLISH_SETTINGS),
    ).toEqual({
      contentHint: 'detail',
      resolution: { width: 2560, height: 1440, frameRate: 30 },
    });
    const publish = buildScreenSharePublishOptions(
      DEFAULT_SCREEN_SHARE_PUBLISH_SETTINGS,
      { width: 2560, height: 1440 },
    );
    expect(publish).toMatchObject({
      simulcast: true,
      videoCodec: 'vp8',
      screenShareEncoding: { maxBitrate: 4_000_000, maxFramerate: 15 },
      degradationPreference: 'maintain-resolution',
    });
    expect(copies(publish)).toEqual([540, 1080]);
    expect(
      copies(
        buildScreenSharePublishOptions(DEFAULT_SCREEN_SHARE_PUBLISH_SETTINGS, {
          width: 1920,
          height: 1080,
        }),
      ),
    ).toEqual([360, 720]);
  });

  it('maps each choice', () => {
    const settings = {
      maxSize: 'native',
      frameRate: 30,
      bitrateMbps: 2.5,
      layers: '360p',
      codec: 'vp9',
    } as const;
    expect(buildScreenShareCaptureOptions(settings).resolution).toEqual({
      width: 0,
      height: 0,
      frameRate: 30,
    });
    const publish = buildScreenSharePublishOptions(settings);
    expect(publish.videoCodec).toBe('vp9');
    expect(publish.screenShareEncoding).toEqual({
      maxBitrate: 2_500_000,
      maxFramerate: 30,
    });
    expect(copies(publish)).toEqual([360]);
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
