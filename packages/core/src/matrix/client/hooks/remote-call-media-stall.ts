type CallFeedLike = {
  isLocal: () => boolean;
  userId?: string | null;
};

export type RemoteCallFeedLike = CallFeedLike & {
  stream?: MediaStream | null;
  isAudioMuted: () => boolean;
  isVideoMuted: () => boolean;
};

type GroupCallFeedsLike = {
  userMediaFeeds: CallFeedLike[];
  screenshareFeeds: CallFeedLike[];
};

type GroupCallRemoteMediaLike = {
  userMediaFeeds: RemoteCallFeedLike[];
  screenshareFeeds: CallFeedLike[];
};

function hasLiveMediaStreamTrack(
  stream: MediaStream,
  kind: 'audio' | 'video',
): boolean {
  const tracks =
    kind === 'audio' ? stream.getAudioTracks() : stream.getVideoTracks();
  return tracks.some((track) => track.readyState === 'live');
}

/**
 * CallFeed exists in the SDK list but WebRTC never delivered live tracks (or they
 * ended). Intentionally muted participants still count as healthy presence.
 */
export function isRemoteCallFeedMediaHealthy(
  feed: RemoteCallFeedLike,
): boolean {
  const wantsAudio = !feed.isAudioMuted();
  const wantsVideo = !feed.isVideoMuted();

  if (!wantsAudio && !wantsVideo) return true;

  const stream = feed.stream ?? null;
  if (!stream) return false;

  const liveAudio = hasLiveMediaStreamTrack(stream, 'audio');
  const liveVideo = hasLiveMediaStreamTrack(stream, 'video');
  if (wantsAudio && liveAudio) return true;
  if (wantsVideo && liveVideo) return true;
  return false;
}

/** Remote participants with at least one userMedia or screenshare CallFeed. */
export function collectRemoteCallFeedUserIds(
  gc: GroupCallFeedsLike,
): Set<string> {
  const ids = new Set<string>();
  for (const feed of [...gc.userMediaFeeds, ...gc.screenshareFeeds]) {
    if (feed.isLocal()) continue;
    const userId = feed.userId?.trim();
    if (userId) ids.add(userId);
  }
  return ids;
}

function findRemoteUserMediaFeed(
  gc: GroupCallRemoteMediaLike,
  userId: string,
): RemoteCallFeedLike | null {
  for (const feed of gc.userMediaFeeds) {
    if (feed.isLocal()) continue;
    if (feed.userId?.trim() === userId) return feed;
  }
  return null;
}

/** Others in the participant map who have no inbound userMedia or share feed yet. */
export function countMissingRemoteCallFeeds(
  othersInCall: string[],
  remoteIdsWithFeed: ReadonlySet<string>,
): number {
  return othersInCall.filter((id) => id && !remoteIdsWithFeed.has(id)).length;
}

/**
 * Participants in the map who lack inbound media: no CallFeed yet, or a zombie
 * userMedia feed with no live tracks while mic/camera are supposed to be on.
 */
export function countUnhealthyRemoteCallMedia(
  gc: GroupCallRemoteMediaLike,
  othersInCall: string[],
): number {
  const remoteIdsWithFeed = collectRemoteCallFeedUserIds(gc);
  let unhealthy = 0;
  for (const id of othersInCall) {
    if (!id) continue;
    if (!remoteIdsWithFeed.has(id)) {
      unhealthy += 1;
      continue;
    }
    const userMediaFeed = findRemoteUserMediaFeed(gc, id);
    if (userMediaFeed && !isRemoteCallFeedMediaHealthy(userMediaFeed)) {
      unhealthy += 1;
    }
  }
  return unhealthy;
}
