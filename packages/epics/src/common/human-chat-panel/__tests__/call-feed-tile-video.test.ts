import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';
import { describe, expect, it } from 'vitest';
import {
  createCallFeedVideoStream,
  hasWarmingCallFeedVideoTrack,
  isCallFeedVideoSurfaceReady,
  resolveCallFeedLiveVideoTrack,
} from '../call-feed-tile-video';

function mockTrack(args: {
  readyState?: MediaStreamTrackState | 'new';
  muted?: boolean;
  enabled?: boolean;
}) {
  return {
    readyState: args.readyState ?? 'live',
    muted: args.muted ?? false,
    enabled: args.enabled ?? true,
  } as MediaStreamTrack;
}

function mockFeed(args: { videoMuted?: boolean; tracks?: MediaStreamTrack[] }) {
  const tracks = args.tracks ?? [];
  return {
    isVideoMuted: () => args.videoMuted ?? false,
    stream:
      tracks.length > 0
        ? ({
            getVideoTracks: () => tracks,
          } as MediaStream)
        : undefined,
  } as CallFeed;
}

describe('resolveCallFeedLiveVideoTrack', () => {
  it('returns a live unmuted enabled track', () => {
    const track = mockTrack({});
    expect(resolveCallFeedLiveVideoTrack(mockFeed({ tracks: [track] }))).toBe(
      track,
    );
  });

  it('ignores muted tracks', () => {
    expect(
      resolveCallFeedLiveVideoTrack(
        mockFeed({ tracks: [mockTrack({ muted: true })] }),
      ),
    ).toBeNull();
  });
});

describe('hasWarmingCallFeedVideoTrack', () => {
  it('is true when a new track exists but is not renderable yet', () => {
    expect(
      hasWarmingCallFeedVideoTrack(
        mockFeed({ tracks: [mockTrack({ readyState: 'new', muted: true })] }),
      ),
    ).toBe(true);
  });

  it('is false when a live track is renderable', () => {
    expect(
      hasWarmingCallFeedVideoTrack(
        mockFeed({ tracks: [mockTrack({ readyState: 'live' })] }),
      ),
    ).toBe(false);
  });
});

describe('createCallFeedVideoStream', () => {
  it('returns null without a track', () => {
    expect(createCallFeedVideoStream(null)).toBeNull();
  });
});

describe('isCallFeedVideoSurfaceReady', () => {
  it('requires non-zero dimensions', () => {
    expect(isCallFeedVideoSurfaceReady({ videoWidth: 0, videoHeight: 0 })).toBe(
      false,
    );
    expect(
      isCallFeedVideoSurfaceReady({ videoWidth: 640, videoHeight: 360 }),
    ).toBe(true);
  });
});
