import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';

export type CallFeedMutedBadgeInput = {
  isLocal: boolean;
  isShare: boolean;
  isMicrophoneMuted?: boolean;
  feedAudioMuted: boolean;
};

/** Share tiles never show mic-muted; camera tiles use GroupCall mic state for local feeds. */
export function shouldShowCallFeedMutedBadge(
  input: CallFeedMutedBadgeInput,
): boolean {
  if (input.isShare) return false;
  if (input.isLocal && input.isMicrophoneMuted !== undefined) {
    return input.isMicrophoneMuted;
  }
  return input.feedAudioMuted;
}

export function feedReportsAudioMutedForTile(
  feed: Pick<CallFeed, 'isLocal' | 'isAudioMuted'>,
  isMicrophoneMuted: boolean | undefined,
  isShare: boolean,
): boolean {
  return shouldShowCallFeedMutedBadge({
    isLocal: feed.isLocal(),
    isShare,
    isMicrophoneMuted,
    feedAudioMuted: feed.isAudioMuted(),
  });
}

export function shouldMountRemoteCallAudioSink(
  feed: Pick<CallFeed, 'isLocal' | 'stream'>,
  isShare: boolean,
): boolean {
  if (feed.isLocal()) return false;
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
