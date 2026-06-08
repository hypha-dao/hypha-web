type CallFeedLike = {
  isLocal: () => boolean;
  userId?: string | null;
};

type GroupCallFeedsLike = {
  userMediaFeeds: CallFeedLike[];
  screenshareFeeds: CallFeedLike[];
};

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

/** Others in the participant map who have no inbound userMedia or share feed yet. */
export function countMissingRemoteCallFeeds(
  othersInCall: string[],
  remoteIdsWithFeed: ReadonlySet<string>,
): number {
  return othersInCall.filter((id) => id && !remoteIdsWithFeed.has(id)).length;
}
