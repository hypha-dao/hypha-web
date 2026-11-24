import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';

/**
 * React key for a participant tile. Must not contain anything that changes without the
 * participant changing (reaction versions, active speaker): a key change remounts the
 * `<video>` and flashes the tile (#2708).
 */
export function feedKey(
  feed: Pick<CallFeed, 'userId' | 'deviceId' | 'purpose'>,
  index: number,
): string {
  return `${feed.userId}:${String(feed.deviceId)}:${String(
    feed.purpose,
  )}:${index}`;
}
