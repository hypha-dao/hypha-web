import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';
import { describe, expect, it } from 'vitest';
import {
  feedReportsAudioMutedForTile,
  formatCallShareTileLabel,
  isLocalCallFeedForTile,
  resolveCallAudioPortalTarget,
  resolveCallDockPortalTarget,
  shouldMountRemoteCallAudioSink,
  shouldShowCallFeedMutedBadge,
} from '../call-feed-tile-audio';

function mockFeed(args: {
  local?: boolean;
  userId?: string;
  audioMuted?: boolean;
  audioTracks?: number;
}) {
  const audioTracks = Array.from({ length: args.audioTracks ?? 0 }, () => ({}));
  return {
    isLocal: () => args.local ?? false,
    userId: args.userId ?? '@remote:hs',
    isAudioMuted: () => args.audioMuted ?? false,
    stream:
      audioTracks.length > 0
        ? ({
            getAudioTracks: () => audioTracks,
          } as MediaStream)
        : undefined,
  } as CallFeed;
}

describe('isLocalCallFeedForTile', () => {
  it('matches the signed-in Matrix user even when CallFeed.isLocal is false', () => {
    expect(
      isLocalCallFeedForTile(
        mockFeed({ local: false, userId: '@me:hs' }),
        '@me:hs',
      ),
    ).toBe(true);
  });
});

describe('shouldShowCallFeedMutedBadge', () => {
  it('never shows muted badge on share tiles', () => {
    expect(
      shouldShowCallFeedMutedBadge({
        isLocal: false,
        isShare: true,
        feedAudioMuted: true,
      }),
    ).toBe(false);
  });

  it('uses GroupCall mic state for local camera tiles', () => {
    expect(
      shouldShowCallFeedMutedBadge({
        isLocal: true,
        isShare: false,
        isMicrophoneMuted: true,
        feedAudioMuted: false,
      }),
    ).toBe(true);
  });

  it('uses feed audio mute for remote camera tiles', () => {
    expect(
      shouldShowCallFeedMutedBadge({
        isLocal: false,
        isShare: false,
        feedAudioMuted: true,
        hasAudioTrack: true,
      }),
    ).toBe(true);
  });

  it('suppresses muted badge on video-only remote feeds', () => {
    expect(
      shouldShowCallFeedMutedBadge({
        isLocal: false,
        isShare: false,
        feedAudioMuted: true,
        hasAudioTrack: false,
      }),
    ).toBe(false);
  });
});

describe('feedReportsAudioMutedForTile', () => {
  it('suppresses share feed muted badge even when feed.isAudioMuted is true', () => {
    expect(
      feedReportsAudioMutedForTile(
        mockFeed({ audioMuted: true }),
        undefined,
        true,
      ),
    ).toBe(false);
  });

  it('uses GroupCall mic state when deviceId mismatch hides local feed', () => {
    expect(
      feedReportsAudioMutedForTile(
        mockFeed({
          local: false,
          userId: '@me:hs',
          audioMuted: true,
          audioTracks: 0,
        }),
        false,
        false,
        '@me:hs',
      ),
    ).toBe(false);
  });
});

describe('shouldMountRemoteCallAudioSink', () => {
  it('mounts remote camera audio sinks', () => {
    expect(
      shouldMountRemoteCallAudioSink(mockFeed({ local: false }), false),
    ).toBe(true);
  });

  it('mounts remote share audio only when the stream has audio tracks', () => {
    expect(
      shouldMountRemoteCallAudioSink(
        mockFeed({ local: false, audioTracks: 0 }),
        true,
      ),
    ).toBe(false);
    expect(
      shouldMountRemoteCallAudioSink(
        mockFeed({ local: false, audioTracks: 1 }),
        true,
      ),
    ).toBe(true);
  });

  it('never mounts local feeds', () => {
    expect(
      shouldMountRemoteCallAudioSink(
        mockFeed({ local: true, audioTracks: 1 }),
        true,
      ),
    ).toBe(false);
  });

  it('never mounts self feed matched by user id', () => {
    expect(
      shouldMountRemoteCallAudioSink(
        mockFeed({ local: false, userId: '@me:hs', audioTracks: 1 }),
        false,
        '@me:hs',
      ),
    ).toBe(false);
  });
});

describe('formatCallShareTileLabel', () => {
  it('combines presenter name and screen share label', () => {
    expect(formatCallShareTileLabel('Alex', 'Screen share')).toBe(
      'Alex · Screen share',
    );
  });

  it('falls back to screen share label when presenter name is empty', () => {
    expect(formatCallShareTileLabel('  ', 'Screen share')).toBe('Screen share');
  });
});

describe('PiP portal targets', () => {
  it('keeps remote audio on the main document', () => {
    const mainBody = { tagName: 'BODY' } as HTMLBodyElement;
    expect(resolveCallAudioPortalTarget({ body: mainBody })).toBe(mainBody);
  });

  it('allows dock chrome to portal into the PiP window', () => {
    const mainBody = { tagName: 'BODY' } as HTMLBodyElement;
    const pipBody = { tagName: 'BODY' } as HTMLBodyElement;
    const pipWindow = { document: { body: pipBody } } as unknown as Window;
    expect(resolveCallDockPortalTarget(pipWindow, { body: mainBody })).toBe(
      pipBody,
    );
    expect(resolveCallDockPortalTarget(null, { body: mainBody })).toBe(
      mainBody,
    );
  });
});
