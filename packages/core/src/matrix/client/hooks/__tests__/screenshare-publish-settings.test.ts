import { describe, expect, it } from 'vitest';

import {
  buildScreenShareCaptureOptions,
  buildScreenSharePublishOptions,
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
