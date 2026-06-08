import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';
import { describe, expect, it } from 'vitest';
import {
  createCallFeedVideoStream,
  hasWarmingCallFeedVideoTrack,
  isCallFeedVideoMutedForTile,
  isCallFeedVideoSurfaceReady,
  resolveCallFeedLiveVideoTrack,
  resolveCallFeedVideoSurfaceClassName,
  shouldMarkCallFeedVideoSurfaceReady,
  shouldPaintCallFeedVideoSurface,
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

function mockFeed(args: {
  videoMuted?: boolean;
  userId?: string;
  local?: boolean;
  tracks?: MediaStreamTrack[];
}) {
  const tracks = args.tracks ?? [];
  return {
    isLocal: () => args.local ?? false,
    isVideoMuted: () => args.videoMuted ?? false,
    userId: args.userId ?? '@remote:hs',
    stream:
      tracks.length > 0
        ? ({
            getVideoTracks: () => tracks,
          } as MediaStream)
        : undefined,
  } as CallFeed;
}

describe('isCallFeedVideoMutedForTile', () => {
  it('uses GroupCall camera state for self feed when deviceId mismatch hides local', () => {
    expect(
      isCallFeedVideoMutedForTile(
        mockFeed({ videoMuted: true, userId: '@me:hs' }),
        { isLocalVideoMuted: false, currentUserId: '@me:hs' },
      ),
    ).toBe(false);
  });
});

describe('resolveCallFeedLiveVideoTrack', () => {
  it('returns a live unmuted enabled track', () => {
    const track = mockTrack({});
    expect(resolveCallFeedLiveVideoTrack(mockFeed({ tracks: [track] }))).toBe(
      track,
    );
  });

  it('binds live muted local camera tracks before the first frame (iOS warming)', () => {
    const track = mockTrack({ muted: true });
    expect(
      resolveCallFeedLiveVideoTrack(
        mockFeed({ tracks: [track], local: true, userId: '@me:hs' }),
        { currentUserId: '@me:hs' },
      ),
    ).toBe(track);
  });

  it('does not bind live muted remote camera tracks before the first frame', () => {
    const track = mockTrack({ muted: true });
    expect(
      resolveCallFeedLiveVideoTrack(mockFeed({ tracks: [track] })),
    ).toBeNull();
    expect(hasWarmingCallFeedVideoTrack(mockFeed({ tracks: [track] }))).toBe(
      true,
    );
  });

  it('binds live muted screen-share tracks before the first frame', () => {
    const track = mockTrack({ muted: true });
    expect(
      resolveCallFeedLiveVideoTrack(mockFeed({ tracks: [track] }), {
        isShare: true,
      }),
    ).toBe(track);
  });
});

describe('hasWarmingCallFeedVideoTrack', () => {
  it('does not warm when a new camera track can bind immediately', () => {
    expect(
      hasWarmingCallFeedVideoTrack(
        mockFeed({ tracks: [mockTrack({ readyState: 'new', muted: true })] }),
      ),
    ).toBe(false);
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
    expect(
      isCallFeedVideoSurfaceReady({
        videoWidth: 0,
        videoHeight: 0,
        clientWidth: 0,
        clientHeight: 0,
        readyState: 0,
      }),
    ).toBe(false);
    expect(
      isCallFeedVideoSurfaceReady({
        videoWidth: 640,
        videoHeight: 360,
        clientWidth: 320,
        clientHeight: 180,
        readyState: 4,
      }),
    ).toBe(true);
  });

  it('accepts sized elements before videoWidth is populated (Safari dock tiles)', () => {
    expect(
      isCallFeedVideoSurfaceReady({
        videoWidth: 0,
        videoHeight: 0,
        clientWidth: 240,
        clientHeight: 135,
        readyState: 2,
      }),
    ).toBe(true);
  });
});

describe('shouldMarkCallFeedVideoSurfaceReady', () => {
  it('rejects muted tracks with zero intrinsic dimensions', () => {
    expect(
      shouldMarkCallFeedVideoSurfaceReady(
        {
          videoWidth: 0,
          videoHeight: 0,
          clientWidth: 240,
          clientHeight: 135,
          readyState: 2,
        },
        { muted: true },
      ),
    ).toBe(false);
  });
});

describe('shouldPaintCallFeedVideoSurface', () => {
  it('does not paint remote muted tracks (show avatar instead)', () => {
    expect(
      shouldPaintCallFeedVideoSurface({
        hasVideo: true,
        warmingVideoTrack: false,
        videoSurfaceReady: true,
        liveVideoTrack: mockTrack({ muted: true }),
        isLocalFeed: false,
      }),
    ).toBe(false);
  });
});

describe('resolveCallFeedVideoSurfaceClassName', () => {
  it('uses max-width containment and object-contain by default (WCUX-QUALITY-3)', () => {
    const className = resolveCallFeedVideoSurfaceClassName({
      mirrorLocalPreview: false,
      showVideoSurface: true,
      isFullView: false,
      isPip: false,
      isShare: false,
      panelFlush: true,
      panelVideoFit: 'contain',
    });

    expect(className).toContain('max-w-full');
    expect(className).toContain('max-h-full');
    expect(className).toContain('object-contain');
    expect(className).not.toContain('object-cover');
  });

  it('allows mirror transform without upscaling scale transforms', () => {
    const className = resolveCallFeedVideoSurfaceClassName({
      mirrorLocalPreview: true,
      showVideoSurface: true,
      isFullView: false,
      isPip: false,
      isShare: false,
      panelFlush: false,
      panelVideoFit: 'contain',
    });

    expect(className).toContain('-scale-x-100');
    expect(className).not.toMatch(/\bscale-\d+/);
  });
});
