import { describe, expect, it } from 'vitest';
import {
  collectRemoteCallFeedUserIds,
  countMissingRemoteCallFeeds,
  countUnhealthyRemoteCallMedia,
  isRemoteCallFeedMediaHealthy,
  isRemoteCallFeedMediaWarming,
} from '../remote-call-media-stall';

function mockFeed(
  userId: string,
  local = false,
  options?: {
    stream?: MediaStream | null;
    audioMuted?: boolean;
    videoMuted?: boolean;
  },
) {
  return {
    isLocal: () => local,
    userId,
    stream: options?.stream ?? null,
    isAudioMuted: () => options?.audioMuted ?? false,
    isVideoMuted: () => options?.videoMuted ?? true,
  };
}

function mockStreamWithTracks(tracks: Partial<MediaStreamTrack>[]) {
  return {
    getAudioTracks: () =>
      tracks.filter((t) => t.kind === 'audio') as MediaStreamTrack[],
    getVideoTracks: () =>
      tracks.filter((t) => t.kind === 'video') as MediaStreamTrack[],
  } as MediaStream;
}

describe('collectRemoteCallFeedUserIds', () => {
  it('includes remote userMedia and screenshare feeds', () => {
    const ids = collectRemoteCallFeedUserIds({
      userMediaFeeds: [mockFeed('@a:hs')],
      screenshareFeeds: [mockFeed('@b:hs')],
    });
    expect([...ids].sort()).toEqual(['@a:hs', '@b:hs']);
  });

  it('ignores local feeds', () => {
    const ids = collectRemoteCallFeedUserIds({
      userMediaFeeds: [mockFeed('@me:hs', true)],
      screenshareFeeds: [mockFeed('@remote:hs')],
    });
    expect([...ids]).toEqual(['@remote:hs']);
  });
});

describe('countMissingRemoteCallFeeds', () => {
  it('counts participants without any inbound feed', () => {
    expect(
      countMissingRemoteCallFeeds(['@a:hs', '@b:hs'], new Set(['@a:hs'])),
    ).toBe(1);
  });
});

describe('isRemoteCallFeedMediaHealthy', () => {
  it('is unhealthy when mic is on but no live audio track', () => {
    expect(
      isRemoteCallFeedMediaHealthy(
        mockFeed('@a:hs', false, {
          stream: mockStreamWithTracks([]),
          audioMuted: false,
          videoMuted: true,
        }),
      ),
    ).toBe(false);
  });

  it('is healthy when both mic and camera are intentionally muted', () => {
    expect(
      isRemoteCallFeedMediaHealthy(
        mockFeed('@a:hs', false, {
          stream: null,
          audioMuted: true,
          videoMuted: true,
        }),
      ),
    ).toBe(true);
  });

  it('is healthy with live audio while camera is off', () => {
    expect(
      isRemoteCallFeedMediaHealthy(
        mockFeed('@a:hs', false, {
          stream: mockStreamWithTracks([
            { kind: 'audio', readyState: 'live', enabled: true },
          ]),
          audioMuted: false,
          videoMuted: true,
        }),
      ),
    ).toBe(true);
  });

  it('is healthy when inbound audio is live but track.muted is still true', () => {
    expect(
      isRemoteCallFeedMediaHealthy(
        mockFeed('@a:hs', false, {
          stream: mockStreamWithTracks([
            {
              kind: 'audio',
              readyState: 'live',
              enabled: true,
              muted: true,
            } as MediaStreamTrack,
          ]),
          audioMuted: false,
          videoMuted: true,
        }),
      ),
    ).toBe(true);
  });
});

describe('isRemoteCallFeedMediaWarming', () => {
  it('treats muted live enabled video as healthy (not warming or zombie)', () => {
    const feed = mockFeed('@a:hs', false, {
      stream: mockStreamWithTracks([
        {
          kind: 'video',
          readyState: 'live',
          enabled: true,
          muted: true,
        } as MediaStreamTrack,
      ]),
      audioMuted: true,
      videoMuted: false,
    });
    expect(isRemoteCallFeedMediaHealthy(feed)).toBe(true);
    expect(isRemoteCallFeedMediaWarming(feed)).toBe(false);
  });
});

describe('countUnhealthyRemoteCallMedia', () => {
  it('treats screenshare-only remote as connected for stall detection', () => {
    expect(
      countUnhealthyRemoteCallMedia(
        {
          userMediaFeeds: [],
          screenshareFeeds: [mockFeed('@presenter:hs')],
        },
        ['@presenter:hs', '@waiting:hs'],
      ),
    ).toBe(1);
  });

  it('counts zombie userMedia feeds with no live tracks', () => {
    expect(
      countUnhealthyRemoteCallMedia(
        {
          userMediaFeeds: [
            mockFeed('@a:hs', false, {
              stream: mockStreamWithTracks([]),
              audioMuted: false,
              videoMuted: true,
            }),
          ],
          screenshareFeeds: [],
        },
        ['@a:hs'],
      ),
    ).toBe(1);
  });

  it('ignores live enabled video feeds during ICE connect', () => {
    expect(
      countUnhealthyRemoteCallMedia(
        {
          userMediaFeeds: [
            mockFeed('@a:hs', false, {
              stream: mockStreamWithTracks([
                {
                  kind: 'video',
                  readyState: 'live',
                  enabled: true,
                  muted: true,
                } as MediaStreamTrack,
              ]),
              audioMuted: true,
              videoMuted: false,
            }),
          ],
          screenshareFeeds: [],
        },
        ['@a:hs'],
      ),
    ).toBe(0);
  });

  it('is clear when remote has live audio', () => {
    expect(
      countUnhealthyRemoteCallMedia(
        {
          userMediaFeeds: [
            mockFeed('@a:hs', false, {
              stream: mockStreamWithTracks([
                {
                  kind: 'audio',
                  readyState: 'live',
                  enabled: true,
                  muted: true,
                } as MediaStreamTrack,
              ]),
              audioMuted: false,
              videoMuted: true,
            }),
          ],
          screenshareFeeds: [],
        },
        ['@a:hs'],
      ),
    ).toBe(0);
  });
});
