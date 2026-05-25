import { describe, expect, it } from 'vitest';
import {
  collectCallVideoSources,
  iterCallScreenshareFeeds,
  layoutCallRecordingTiles,
} from '../call-recording';

function fakeTrack(id: string): MediaStreamTrack {
  return { id, readyState: 'live' } as MediaStreamTrack;
}

function fakeStream(track: MediaStreamTrack): MediaStream {
  return {
    id: `stream-${track.id}`,
    getVideoTracks: () => [track],
    getAudioTracks: () => [],
  } as unknown as MediaStream;
}

function fakeFeed(options: {
  track: MediaStreamTrack;
  videoMuted?: boolean;
  isLocal?: boolean;
  userId?: string;
  deviceId?: string;
}) {
  const stream = fakeStream(options.track);
  return {
    stream,
    userId: options.userId ?? 'user',
    deviceId: options.deviceId ?? 'device',
    isVideoMuted: () => options.videoMuted ?? false,
    isLocal: () => options.isLocal ?? false,
  };
}

describe('layoutCallRecordingTiles', () => {
  it('lays out two cameras side by side when there is no screenshare', () => {
    const tiles = layoutCallRecordingTiles(
      [
        {
          track: fakeTrack('a'),
          stream: fakeStream(fakeTrack('a')),
          kind: 'camera',
        },
        {
          track: fakeTrack('b'),
          stream: fakeStream(fakeTrack('b')),
          kind: 'camera',
        },
      ],
      640,
      360,
    );
    expect(tiles).toHaveLength(2);
    expect(tiles[0]?.w).toBe(320);
    expect(tiles[1]?.x).toBe(320);
  });

  it('gives screenshare the main area and cameras a strip', () => {
    const tiles = layoutCallRecordingTiles(
      [
        {
          track: fakeTrack('screen'),
          stream: fakeStream(fakeTrack('screen')),
          kind: 'screenshare',
        },
        {
          track: fakeTrack('cam'),
          stream: fakeStream(fakeTrack('cam')),
          kind: 'camera',
        },
      ],
      640,
      360,
    );
    expect(tiles[0]?.h).toBeGreaterThan(tiles[1]?.h ?? 0);
    expect(tiles[1]?.y).toBe(tiles[0]?.h);
  });
});

describe('iterCallScreenshareFeeds', () => {
  it('includes localScreenshareFeed when it is not listed yet', () => {
    const localTrack = fakeTrack('local-share');
    const localFeed = fakeFeed({ track: localTrack, isLocal: true });
    const groupCall = {
      screenshareFeeds: [],
      localScreenshareFeed: localFeed,
    } as never;

    expect(iterCallScreenshareFeeds(groupCall)).toEqual([localFeed]);
  });
});

describe('collectCallVideoSources', () => {
  it('collects screenshare before cameras and skips muted feeds', () => {
    const screenTrack = fakeTrack('screen');
    const camTrack = fakeTrack('cam');
    const mutedTrack = fakeTrack('muted');
    const groupCall = {
      screenshareFeeds: [fakeFeed({ track: screenTrack, isLocal: false })],
      localScreenshareFeed: undefined,
      localCallFeed: fakeFeed({ track: camTrack, isLocal: true }),
      userMediaFeeds: [
        fakeFeed({ track: mutedTrack, videoMuted: true, isLocal: false }),
      ],
    } as never;

    const sources = collectCallVideoSources(groupCall);
    expect(sources.map((source) => source.track.id)).toEqual(['screen', 'cam']);
    expect(sources[0]?.kind).toBe('screenshare');
  });

  it('prefers remote screenshare over the local mirror feed', () => {
    const remoteTrack = fakeTrack('remote-share');
    const localTrack = fakeTrack('local-share');
    const groupCall = {
      screenshareFeeds: [
        fakeFeed({
          track: localTrack,
          isLocal: true,
          userId: '@me:hs',
          deviceId: 'a',
        }),
        fakeFeed({
          track: remoteTrack,
          isLocal: false,
          userId: '@them:hs',
          deviceId: 'b',
        }),
      ],
      localScreenshareFeed: fakeFeed({
        track: localTrack,
        isLocal: true,
        userId: '@me:hs',
        deviceId: 'a',
      }),
      localCallFeed: undefined,
      userMediaFeeds: [],
    } as never;

    expect(collectCallVideoSources(groupCall)[0]?.track.id).toBe(
      'remote-share',
    );
  });
});
