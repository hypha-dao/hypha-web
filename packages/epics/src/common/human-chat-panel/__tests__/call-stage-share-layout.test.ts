import { describe, expect, it } from 'vitest';
import {
  hasWarmingRemoteShareFeed,
  isLiveUnmutedShareFeed,
  resolveCallStageShareLayout,
  shareFeedLayoutKey,
} from '../call-stage-share-layout';

type MockTrack = {
  readyState: MediaStreamTrackState;
  muted: boolean;
};

function mockFeed(args: {
  local?: boolean;
  videoMuted?: boolean;
  tracks?: MockTrack[];
  userId?: string;
  streamId?: string;
}) {
  const tracks = args.tracks ?? [];
  const stream =
    tracks.length > 0
      ? ({
          id: args.streamId ?? 'stream-1',
          getVideoTracks: () =>
            tracks.map(
              (track) =>
                ({
                  readyState: track.readyState,
                  muted: track.muted,
                }) as MediaStreamTrack,
            ),
        } as MediaStream)
      : undefined;

  return {
    isLocal: () => args.local ?? false,
    isVideoMuted: () => args.videoMuted ?? false,
    stream,
    userId: args.userId ?? (args.local ? '@me:hs' : '@remote:hs'),
    deviceId: 'dev',
  };
}

describe('resolveCallStageShareLayout', () => {
  it('treats local presenter as active before the capture track is live', () => {
    const rawShareFeeds = [
      mockFeed({
        local: true,
        tracks: [{ readyState: 'new', muted: false }],
      }),
    ];

    const layout = resolveCallStageShareLayout({
      rawShareFeeds,
      isScreensharing: true,
      isVideoCall: true,
    });

    expect(layout.shareFeeds).toHaveLength(0);
    expect(layout.localShareActive).toBe(true);
    expect(layout.presenterShareOnly).toBe(true);
    expect(layout.hasRenderableShare).toBe(true);
  });

  it('keeps share layout while a remote feed is warming up during handoff', () => {
    const rawShareFeeds = [
      mockFeed({
        userId: '@presenter:hs',
        tracks: [{ readyState: 'new', muted: false }],
      }),
    ];

    const layout = resolveCallStageShareLayout({
      rawShareFeeds,
      isScreensharing: false,
      isVideoCall: true,
    });

    expect(layout.shareFeeds).toHaveLength(0);
    expect(layout.hasPendingRemoteShare).toBe(true);
    expect(layout.hasRenderableShare).toBe(true);
    expect(layout.localShareActive).toBe(false);
  });

  it('renders remote live share for viewers and hides local mirror', () => {
    const remote = mockFeed({
      userId: '@presenter:hs',
      tracks: [{ readyState: 'live', muted: false }],
    });
    const localMirror = mockFeed({
      local: true,
      tracks: [{ readyState: 'live', muted: false }],
    });

    const layout = resolveCallStageShareLayout({
      rawShareFeeds: [remote, localMirror],
      isScreensharing: false,
      isVideoCall: true,
    });

    expect(layout.shareFeeds).toHaveLength(1);
    expect(layout.localShareActive).toBe(false);
    expect(layout.hasRenderableShare).toBe(true);
  });

  it('drops ended ghost feeds so layout does not reserve empty share space', () => {
    const ended = mockFeed({
      userId: '@old:hs',
      tracks: [{ readyState: 'ended', muted: false }],
    });

    const layout = resolveCallStageShareLayout({
      rawShareFeeds: [ended],
      isScreensharing: false,
      isVideoCall: true,
    });

    expect(layout.shareFeeds).toHaveLength(0);
    expect(layout.hasPendingRemoteShare).toBe(false);
    expect(layout.hasRenderableShare).toBe(false);
  });
});

describe('isLiveUnmutedShareFeed', () => {
  it('requires a live unmuted track', () => {
    expect(
      isLiveUnmutedShareFeed(
        mockFeed({ tracks: [{ readyState: 'live', muted: true }] }),
      ),
    ).toBe(false);
    expect(
      isLiveUnmutedShareFeed(
        mockFeed({ tracks: [{ readyState: 'live', muted: false }] }),
      ),
    ).toBe(true);
  });
});

describe('hasWarmingRemoteShareFeed', () => {
  it('ignores local feeds', () => {
    expect(
      hasWarmingRemoteShareFeed(
        mockFeed({
          local: true,
          tracks: [{ readyState: 'new', muted: false }],
        }),
      ),
    ).toBe(false);
  });
});

describe('shareFeedLayoutKey', () => {
  it('changes when the active share stream identity changes', () => {
    const a = shareFeedLayoutKey([
      mockFeed({ userId: '@a:hs', streamId: 's1' }),
    ]);
    const b = shareFeedLayoutKey([
      mockFeed({ userId: '@b:hs', streamId: 's2' }),
    ]);
    expect(a).not.toBe(b);
  });
});
