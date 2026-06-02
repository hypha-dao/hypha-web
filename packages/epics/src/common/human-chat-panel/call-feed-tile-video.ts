import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';

/** Live, enabled, unmuted video track suitable for rendering a participant tile. */
export function resolveCallFeedLiveVideoTrack(
  feed: Pick<CallFeed, 'isVideoMuted' | 'stream'>,
): MediaStreamTrack | null {
  if (feed.isVideoMuted()) return null;
  const stream = feed.stream;
  if (!stream) return null;
  return (
    stream
      .getVideoTracks()
      .find(
        (track) => track.readyState === 'live' && track.enabled && !track.muted,
      ) ?? null
  );
}

/**
 * Video track exists but is not yet producing frames — show avatar instead of a
 * black `<video>` surface while WebRTC warms up.
 */
export function hasWarmingCallFeedVideoTrack(
  feed: Pick<CallFeed, 'isVideoMuted' | 'stream'>,
): boolean {
  if (feed.isVideoMuted()) return false;
  const stream = feed.stream;
  if (!stream) return false;
  if (resolveCallFeedLiveVideoTrack(feed)) return false;
  return stream.getVideoTracks().some((track) => {
    if (!track.enabled) return false;
    const state = track.readyState as string;
    return state === 'live' || state === 'new';
  });
}

/** Bind one video track per element — avoids sharing the full A/V stream. */
export function createCallFeedVideoStream(
  track: MediaStreamTrack | null | undefined,
): MediaStream | null {
  if (!track) return null;
  return new MediaStream([track]);
}

export function isCallFeedVideoSurfaceReady(
  video: Pick<HTMLVideoElement, 'videoWidth' | 'videoHeight'>,
): boolean {
  return video.videoWidth > 0 && video.videoHeight > 0;
}
