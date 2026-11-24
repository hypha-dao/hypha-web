import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';

export type CallFeedMutedBadgeInput = {
  isLocal: boolean;
  isShare: boolean;
  isMicrophoneMuted?: boolean;
  feedAudioMuted: boolean;
  /** Matrix reports muted when a userMedia feed has zero audio tracks (video-only). */
  hasAudioTrack?: boolean;
};

/**
 * iPad/WebKit can mismatch `deviceId`, so `CallFeed.isLocal()` is false for self.
 * Prefer Matrix user id match when deciding local tile chrome.
 */
export function isLocalCallFeedForTile(
  feed: Pick<CallFeed, 'isLocal' | 'userId'>,
  currentUserId: string | null | undefined,
): boolean {
  if (feed.isLocal()) return true;
  return Boolean(currentUserId && feed.userId === currentUserId);
}

/** Share tiles never show mic-muted; camera tiles use GroupCall mic state for local feeds. */
export function shouldShowCallFeedMutedBadge(
  input: CallFeedMutedBadgeInput,
): boolean {
  if (input.isShare) return false;
  if (input.isLocal && input.isMicrophoneMuted !== undefined) {
    return input.isMicrophoneMuted;
  }
  if (input.hasAudioTrack === false) return false;
  return input.feedAudioMuted;
}

export function feedReportsAudioMutedForTile(
  feed: Pick<CallFeed, 'isLocal' | 'isAudioMuted' | 'userId' | 'stream'>,
  isMicrophoneMuted: boolean | undefined,
  isShare: boolean,
  currentUserId?: string | null,
): boolean {
  const hasAudioTrack = (feed.stream?.getAudioTracks().length ?? 0) > 0;
  return shouldShowCallFeedMutedBadge({
    isLocal: isLocalCallFeedForTile(feed, currentUserId),
    isShare,
    isMicrophoneMuted,
    hasAudioTrack,
    feedAudioMuted: feed.isAudioMuted(),
  });
}

export function shouldMountRemoteCallAudioSink(
  feed: Pick<CallFeed, 'isLocal' | 'stream' | 'userId'>,
  isShare: boolean,
  currentUserId?: string | null,
): boolean {
  if (isLocalCallFeedForTile(feed, currentUserId)) return false;
  if (!isShare) return true;
  return (feed.stream?.getAudioTracks().length ?? 0) > 0;
}

export function formatCallShareTileLabel(
  presenterName: string,
  screenShareLabel: string,
): string {
  const name = presenterName.trim();
  if (!name) return screenShareLabel;
  return `${name} · ${screenShareLabel}`;
}

/** Dock chrome may portal to PiP; remote audio sinks stay on the main document. */
export function resolveCallDockPortalTarget(
  pipWindow: Window | null | undefined,
  mainDocument: Pick<Document, 'body'>,
): Element {
  return pipWindow?.document.body ?? mainDocument.body;
}

export function resolveCallAudioPortalTarget(
  mainDocument: Pick<Document, 'body'>,
): Element {
  return mainDocument.body;
}

export type RemoteCallAudioSinkEntry<F> = {
  /** Stable across layout and active-speaker changes: `userId:deviceId:purpose`. */
  key: string;
  feed: F;
  isShare: boolean;
};

/** Identity of one remote audio sink; never includes layout, index or reactions. */
export function remoteCallAudioSinkKey(
  feed: Pick<CallFeed, 'userId' | 'deviceId' | 'purpose'>,
): string {
  return `${feed.userId}:${String(feed.deviceId)}:${String(feed.purpose)}`;
}

/**
 * One entry per remote feed that should play audio, in a flat list independent of
 * which tile (if any) currently shows the participant.
 */
export function buildRemoteCallAudioSinkEntries<
  F extends Pick<
    CallFeed,
    'isLocal' | 'stream' | 'userId' | 'deviceId' | 'purpose'
  >,
>(
  userMediaFeeds: readonly F[],
  shareFeeds: readonly F[],
  currentUserId?: string | null,
): RemoteCallAudioSinkEntry<F>[] {
  const out: RemoteCallAudioSinkEntry<F>[] = [];
  const seen = new Set<string>();
  const add = (feed: F, isShare: boolean) => {
    if (!shouldMountRemoteCallAudioSink(feed, isShare, currentUserId)) return;
    const key = remoteCallAudioSinkKey(feed);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, feed, isShare });
  };
  for (const feed of userMediaFeeds) add(feed, false);
  for (const feed of shareFeeds) add(feed, true);
  return out;
}

/**
 * Feeds are rebuilt (new `MediaStream`) on every stage render, so sinks rebind on the
 * identity of the audio tracks, not of the stream object.
 */
export function callAudioStreamSignature(
  stream: Pick<MediaStream, 'getAudioTracks'> | null | undefined,
): string {
  if (!stream) return '';
  return stream
    .getAudioTracks()
    .map((track) => track.id)
    .join('|');
}
