import type { IScreensharingOpts } from 'matrix-js-sdk/lib/webrtc/mediaHandler';

/**
 * Matrix `GroupCall.setScreensharingEnabled` opts — request tab/window audio when
 * supported. SDK types only declare `audio?: boolean` but forwards the value to
 * `getDisplayMedia`, which accepts `MediaTrackConstraints` at runtime.
 */
export const MATRIX_SCREENSHARE_CAPTURE_OPTS = {
  audio: {
    suppressLocalAudioPlayback: false,
  },
} as unknown as IScreensharingOpts;

export function screenshareStreamHasTabAudio(
  stream: MediaStream | null | undefined,
): boolean {
  return (stream?.getAudioTracks().length ?? 0) > 0;
}

type MatrixMediaHandlerLike = {
  screensharingStreams?: MediaStream[];
  stopScreensharingStream: (stream: MediaStream) => void;
};

/**
 * Matrix `MediaHandler` caches the last screenshare stream and clones it on the
 * next request. Clear orphaned entries before a fresh `getDisplayMedia` prompt.
 */
export function clearOrphanedMatrixScreenshareStreams(
  client: { getMediaHandler?: () => MatrixMediaHandlerLike } | null | undefined,
): void {
  const handler = client?.getMediaHandler?.();
  const cached = handler?.screensharingStreams;
  if (!handler || !cached?.length) return;
  for (const stream of [...cached]) {
    try {
      handler.stopScreensharingStream(stream);
    } catch {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
  }
}

/** Browser "Stop sharing" ends tracks — route through Hypha cleanup, not SDK-only stop. */
export function bindScreenshareStreamStopHandlers(
  stream: MediaStream | null | undefined,
  onStopped: () => void,
): () => void {
  if (!stream) return () => undefined;
  const tracks = stream.getTracks();
  if (tracks.length === 0) return () => undefined;

  const onEnded = () => {
    onStopped();
  };
  for (const track of tracks) {
    track.addEventListener('ended', onEnded);
  }
  return () => {
    for (const track of tracks) {
      track.removeEventListener('ended', onEnded);
    }
  };
}
