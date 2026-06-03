import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';
import { isLocalCallFeedForTile } from './call-feed-tile-audio';

/** Live, enabled video track suitable for rendering a participant tile. */
export function isCallFeedVideoMutedForTile(
  feed: Pick<CallFeed, 'isVideoMuted' | 'userId' | 'isLocal'>,
  options?: {
    isShare?: boolean;
    isLocalVideoMuted?: boolean;
    currentUserId?: string | null;
  },
): boolean {
  if (options?.isShare) return feed.isVideoMuted();
  if (
    isLocalCallFeedForTile(feed, options?.currentUserId) &&
    options?.isLocalVideoMuted !== undefined
  ) {
    return options.isLocalVideoMuted;
  }
  return feed.isVideoMuted();
}

/** Live, enabled video track suitable for rendering a participant tile. */
export function resolveCallFeedLiveVideoTrack(
  feed: Pick<CallFeed, 'isVideoMuted' | 'stream' | 'userId' | 'isLocal'>,
  options?: {
    isShare?: boolean;
    isLocalVideoMuted?: boolean;
    currentUserId?: string | null;
  },
): MediaStreamTrack | null {
  if (isCallFeedVideoMutedForTile(feed, options)) return null;
  const stream = feed.stream;
  if (!stream) return null;
  const tracks = stream.getVideoTracks().filter((track) => track.enabled);
  if (options?.isShare) {
    /**
     * Screen-share tracks often stay `muted: true` until the first frame arrives.
     * Bind them anyway so `<video>` can paint as soon as WebRTC delivers pixels.
     */
    return (
      tracks.find((track) => track.readyState === 'live' && !track.muted) ??
      tracks.find((track) => track.readyState === 'live') ??
      tracks.find((track) => (track.readyState as string) === 'new') ??
      null
    );
  }
  return (
    tracks.find((track) => track.readyState === 'live' && !track.muted) ??
    tracks.find((track) => track.readyState === 'live') ??
    tracks.find((track) => (track.readyState as string) === 'new') ??
    null
  );
}

/**
 * Video track exists but is not yet producing frames — show avatar instead of a
 * black `<video>` surface while WebRTC warms up.
 */
export function hasWarmingCallFeedVideoTrack(
  feed: Pick<CallFeed, 'isVideoMuted' | 'stream' | 'userId' | 'isLocal'>,
  options?: {
    isShare?: boolean;
    isLocalVideoMuted?: boolean;
    currentUserId?: string | null;
  },
): boolean {
  if (options?.isShare) return false;
  if (isCallFeedVideoMutedForTile(feed, options)) return false;
  const stream = feed.stream;
  if (!stream) return false;
  if (resolveCallFeedLiveVideoTrack(feed, options)) return false;
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
  video: Pick<
    HTMLVideoElement,
    'videoWidth' | 'videoHeight' | 'clientWidth' | 'clientHeight' | 'readyState'
  >,
): boolean {
  if (video.videoWidth > 0 && video.videoHeight > 0) return true;
  /** Safari / iOS can paint frames before `videoWidth` is populated in dock tiles. */
  return (
    video.clientWidth >= 2 && video.clientHeight >= 2 && video.readyState >= 2
  );
}

/** WCUX-QUALITY-3: letterbox instead of upscaling beyond intrinsic frame size. */
export function resolveCallFeedVideoSurfaceClassName(options: {
  mirrorLocalPreview: boolean;
  showVideoSurface: boolean;
  isFullView: boolean;
  isPip: boolean;
  isShare: boolean;
  panelFlush: boolean;
  panelVideoFit: 'cover' | 'contain';
}): string {
  const {
    mirrorLocalPreview,
    showVideoSurface,
    isFullView,
    isPip,
    isShare,
    panelFlush,
    panelVideoFit,
  } = options;
  const classes = [
    'absolute inset-0 z-[1] m-auto h-full w-full min-h-0 max-h-full max-w-full translate-z-0',
    mirrorLocalPreview ? '-scale-x-100' : '',
    !showVideoSurface ? 'opacity-0' : '',
    'object-contain',
  ];
  if (
    !isShare &&
    !isFullView &&
    panelFlush &&
    !isPip &&
    panelVideoFit === 'cover'
  ) {
    classes[classes.length - 1] = 'object-cover';
  }
  return classes.filter(Boolean).join(' ');
}
