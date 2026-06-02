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

type DisplayMediaConstraints = {
  video: boolean | MediaTrackConstraints;
  audio: boolean | MediaTrackConstraints;
  preferCurrentTab?: boolean;
  selfBrowserSurface?: 'include' | 'exclude';
  systemAudio?: 'include' | 'exclude';
};

type ScreenshareConstraintOpts = Pick<IScreensharingOpts, 'audio'>;

/**
 * Full `getDisplayMedia` constraints — Matrix SDK only forwards `audio`/`video`,
 * so Hypha patches `MediaHandler.getScreenshareContraints` via
 * {@link withEnhancedScreenshareCapture} to include Chrome tab/system audio hints.
 */
export function buildDisplayMediaConstraints(
  opts: ScreenshareConstraintOpts = MATRIX_SCREENSHARE_CAPTURE_OPTS,
): DisplayMediaConstraints {
  const audio =
    opts.audio === undefined || opts.audio === false
      ? false
      : opts.audio === true
      ? true
      : opts.audio;

  return {
    video: true,
    audio,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    systemAudio: 'include',
  };
}

type MediaHandlerWithConstraints = {
  getScreenshareContraints?: (opts: IScreensharingOpts) => unknown;
};

type MatrixClientWithMediaHandler = {
  getMediaHandler?: () => unknown;
};

/**
 * Matrix `MediaHandler.getScreenshareContraints` omits Chrome display-media hints.
 * Patch for the duration of `run` so tab audio is requested by default in the picker.
 */
export async function withEnhancedScreenshareCapture<T>(
  client: MatrixClientWithMediaHandler | null | undefined,
  run: () => Promise<T>,
): Promise<T> {
  const handler = client?.getMediaHandler?.() as
    | MediaHandlerWithConstraints
    | undefined;
  if (!handler?.getScreenshareContraints) {
    return run();
  }

  const original = handler.getScreenshareContraints.bind(handler);
  handler.getScreenshareContraints = (opts) =>
    buildDisplayMediaConstraints(opts);

  try {
    return await run();
  } finally {
    handler.getScreenshareContraints = original;
  }
}

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
  client: MatrixClientWithMediaHandler | null | undefined,
): void {
  const handler = client?.getMediaHandler?.() as
    | MatrixMediaHandlerLike
    | undefined;
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
