import { beforeEach, describe, expect, it } from 'vitest';
import type { LocalVideoTrack } from 'livekit-client';

import {
  CALL_SHARE_SMOOTH_MAX_BITRATE,
  CALL_SHARE_SMOOTH_MAX_FRAMERATE,
  shareEncodingsForMode,
  shareModeFromEncodings,
  topEncodingIndex,
} from '../call-share-send-mode';
import {
  applyShareSendMode,
  resetShareSendModeStoreForTests,
} from '../use-share-send-mode';

type Enc = RTCRtpEncodingParameters & { maxFramerate?: number };

/** What livekit-client publishes for today's share: 360p, 720p and full size (low to high). */
const published = (): Enc[] => [
  { rid: 'q', scaleResolutionDownBy: 3, maxBitrate: 400_000, maxFramerate: 15 },
  {
    rid: 'h',
    scaleResolutionDownBy: 1.5,
    maxBitrate: 1_500_000,
    maxFramerate: 15,
  },
  {
    rid: 'f',
    scaleResolutionDownBy: 1,
    maxBitrate: 2_500_000,
    maxFramerate: 15,
  },
];
const detailTop = { maxFramerate: 15, maxBitrate: 2_500_000 };

describe('topEncodingIndex', () => {
  it('picks the full-size layer, unset scale counting as 1', () => {
    expect(topEncodingIndex(published())).toBe(2);
    expect(topEncodingIndex([{ scaleResolutionDownBy: 2 }, {}])).toBe(1);
    expect(topEncodingIndex([])).toBe(-1);
  });
});

describe('shareEncodingsForMode', () => {
  it('Smooth raises only the top layer to 30 fps and a larger bitrate, same resolution', () => {
    const next = shareEncodingsForMode(published(), 'smooth', detailTop);
    expect(next[2]).toMatchObject({
      scaleResolutionDownBy: 1,
      maxFramerate: CALL_SHARE_SMOOTH_MAX_FRAMERATE,
      maxBitrate: CALL_SHARE_SMOOTH_MAX_BITRATE,
    });
    expect(next.slice(0, 2)).toEqual(published().slice(0, 2));
  });

  it('Detail restores the publish-time values exactly', () => {
    const smooth = shareEncodingsForMode(published(), 'smooth', detailTop);
    expect(shareEncodingsForMode(smooth, 'detail', detailTop)).toEqual(
      published(),
    );
  });

  it('does not mutate its input', () => {
    const input = published();
    shareEncodingsForMode(input, 'smooth', detailTop);
    expect(input).toEqual(published());
  });
});

describe('shareModeFromEncodings', () => {
  it('reads back which mode the sender is in', () => {
    expect(shareModeFromEncodings(published(), detailTop)).toBe('detail');
    expect(
      shareModeFromEncodings(
        shareEncodingsForMode(published(), 'smooth', detailTop),
        detailTop,
      ),
    ).toBe('smooth');
    expect(shareModeFromEncodings([], detailTop)).toBeUndefined();
  });
});

function fakeTrack(options: { failTimes?: number; ignore?: boolean } = {}) {
  let encodings = published();
  let failures = options.failTimes ?? 0;
  const sender = {
    getParameters: () => ({ encodings: encodings.map((e) => ({ ...e })) }),
    setParameters: async (params: { encodings: Enc[] }) => {
      if (failures > 0) {
        failures -= 1;
        throw new Error('InvalidStateError');
      }
      if (!options.ignore) encodings = params.encodings;
    },
  };
  return {
    track: { sender } as unknown as LocalVideoTrack,
    current: () => encodings,
  };
}

describe('applyShareSendMode', () => {
  beforeEach(() => resetShareSendModeStoreForTests());

  it('switches to Smooth and back to Detail live', async () => {
    const { track, current } = fakeTrack();
    await expect(applyShareSendMode(track, 'sid1', 'smooth')).resolves.toBe(
      'smooth',
    );
    expect(current()[2]?.maxFramerate).toBe(CALL_SHARE_SMOOTH_MAX_FRAMERATE);
    await expect(applyShareSendMode(track, 'sid1', 'detail')).resolves.toBe(
      'detail',
    );
    expect(current()).toEqual(published());
  });

  it('retries once when the parameters were invalidated', async () => {
    const { track } = fakeTrack({ failTimes: 1 });
    await expect(applyShareSendMode(track, 'sid2', 'smooth')).resolves.toBe(
      'smooth',
    );
  });

  it('reports the mode actually in effect when the browser ignores the change', async () => {
    const { track } = fakeTrack({ ignore: true });
    await expect(applyShareSendMode(track, 'sid3', 'smooth')).resolves.toBe(
      'detail',
    );
  });
});
