import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';

export type CallStageShareLayoutState = {
  /** Remote share feeds with a live, unmuted video track — safe to render. */
  shareFeeds: CallFeed[];
  /** Local user is the active presenter (no remote live share to show). */
  localShareActive: boolean;
  /** Presenter view: participants only, no self-share mirror pane. */
  presenterShareOnly: boolean;
  /** Keep share + participants layout (includes warming / handoff remote feeds). */
  hasRenderableShare: boolean;
  /** Remote share stream exists but video track is not live yet (presenter handoff). */
  hasPendingRemoteShare: boolean;
};

/** Live, unmuted video suitable for rendering a share tile. */
export function isLiveUnmutedShareFeed(feed: CallFeed): boolean {
  const stream = feed.stream;
  if (!stream || feed.isVideoMuted()) return false;
  const liveVideoTrack = stream
    .getVideoTracks()
    .find(
      (track: MediaStreamTrack) => track.readyState === 'live' && !track.muted,
    );
  return Boolean(liveVideoTrack);
}

/**
 * Remote feed with a video track still attached but not yet live — common for a
 * few frames when ownership transfers between presenters.
 */
export function hasWarmingRemoteShareFeed(feed: CallFeed): boolean {
  if (feed.isLocal() || feed.isVideoMuted()) return false;
  const stream = feed.stream;
  if (!stream) return false;
  return stream.getVideoTracks().some((track: MediaStreamTrack) => {
    const state = track.readyState as string;
    return state === 'live' || state === 'new';
  });
}

/** Remote share feed with a video track that can be bound (includes WebRTC-warming tracks). */
export function isRenderableRemoteShareFeed(feed: CallFeed): boolean {
  if (feed.isLocal() || feed.isVideoMuted()) return false;
  const stream = feed.stream;
  if (!stream) return false;
  return stream.getVideoTracks().some((track: MediaStreamTrack) => {
    if (!track.enabled) return false;
    const state = track.readyState as string;
    return state === 'live' || state === 'new';
  });
}

export function resolveCallStageShareLayout(args: {
  rawShareFeeds: CallFeed[];
  isScreensharing: boolean;
  isVideoCall: boolean;
}): CallStageShareLayoutState {
  const { rawShareFeeds, isScreensharing, isVideoCall } = args;

  const shareFeeds = rawShareFeeds.filter(isRenderableRemoteShareFeed);

  /**
   * Trust hook/SDK screenshare flag when no remote live share is visible — covers
   * the gap before the local capture track reaches readyState "live".
   */
  const localShareActive = isScreensharing && shareFeeds.length === 0;

  /** Remote feed object exists but Matrix has not attached a video track yet. */
  const hasPendingRemoteShare =
    isVideoCall &&
    shareFeeds.length === 0 &&
    rawShareFeeds.some(
      (feed) =>
        !feed.isLocal() &&
        !feed.isVideoMuted() &&
        (!feed.stream || feed.stream.getVideoTracks().length === 0),
    );

  const presenterShareOnly = localShareActive && shareFeeds.length === 0;
  const hasRenderableShare =
    shareFeeds.length > 0 || localShareActive || hasPendingRemoteShare;

  return {
    shareFeeds,
    localShareActive,
    presenterShareOnly,
    hasRenderableShare,
    hasPendingRemoteShare,
  };
}

export function shareFeedLayoutKey(feeds: CallFeed[]): string {
  return feeds
    .map((feed) => {
      const userId = feed.userId?.trim() ?? '';
      const deviceId = feed.deviceId?.trim() ?? '';
      const streamId = feed.stream?.id ?? '';
      return `${userId}:${deviceId}:${streamId}`;
    })
    .join('|');
}
