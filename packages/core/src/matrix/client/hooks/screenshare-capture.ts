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

/** iPadOS 13+ may report MacIntel; iOS Chrome (CriOS) still uses WebKit capture. */
export function isIOSTouchDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/** Safari / WebKit (macOS, iOS) — excludes Chromium-based browsers on Apple platforms. */
export function isWebKitBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /AppleWebKit/i.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|Chrome|Chromium|Edg\//i.test(ua)
  );
}

/** Matrix `setScreensharingEnabled` opts — iOS has no tab/system display audio. */
export function resolveMatrixScreenshareCaptureOpts(): IScreensharingOpts {
  if (isIOSTouchDevice()) {
    return { audio: false } as IScreensharingOpts;
  }
  return MATRIX_SCREENSHARE_CAPTURE_OPTS;
}

/**
 * Display-media constraint profile.
 * `browser` — native picker (Chrome tab / window / entire screen); default for the share button.
 * `tab` | `window` | `monitor` — programmatic hints when a specific surface is required.
 */
export type CallScreenshareSurfaceMode =
  | 'browser'
  | 'tab'
  | 'window'
  | 'monitor';

type DisplayMediaConstraints = {
  video: boolean | MediaTrackConstraints;
  audio: boolean | MediaTrackConstraints;
  preferCurrentTab?: boolean;
  selfBrowserSurface?: 'include' | 'exclude';
  systemAudio?: 'include' | 'exclude';
  monitorTypeSurfaces?: 'include' | 'exclude';
};

const DEFAULT_SCREENSHARE_SURFACE_MODE: CallScreenshareSurfaceMode = 'browser';

type ScreenshareConstraintOpts = Pick<IScreensharingOpts, 'audio'>;

/** Chrome pre-checks "Also share system audio" when `systemAudio: 'include'` is set. */
function resolveDisplayMediaAudioConstraint(
  opts: ScreenshareConstraintOpts,
  surfaceMode: CallScreenshareSurfaceMode,
): boolean | MediaTrackConstraints {
  if (opts.audio === undefined || opts.audio === false) {
    return false;
  }
  if (opts.audio === true) {
    return true;
  }
  if (surfaceMode === 'window' || surfaceMode === 'monitor') {
    return true;
  }
  return opts.audio;
}

/**
 * Full `getDisplayMedia` constraints — Matrix SDK only forwards `audio`/`video`,
 * so Hypha patches `MediaHandler.getScreenshareContraints` via
 * {@link withEnhancedScreenshareCapture} to include Chrome tab/system audio hints.
 */
export function buildDisplayMediaConstraints(
  opts: ScreenshareConstraintOpts = MATRIX_SCREENSHARE_CAPTURE_OPTS,
  surfaceMode: CallScreenshareSurfaceMode = DEFAULT_SCREENSHARE_SURFACE_MODE,
): DisplayMediaConstraints {
  if (isIOSTouchDevice()) {
    return { video: true, audio: false };
  }

  const audio = resolveDisplayMediaAudioConstraint(opts, surfaceMode);

  const base = {
    video: true,
    audio,
    systemAudio: 'include' as const,
  };

  switch (surfaceMode) {
    case 'browser':
      return base;
    case 'window':
      return {
        ...base,
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        monitorTypeSurfaces: 'exclude',
      };
    case 'monitor':
      return {
        ...base,
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        monitorTypeSurfaces: 'include',
      };
    case 'tab':
      return {
        ...base,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
      };
    default:
      return base;
  }
}

/** True when the captured surface is a browser tab (for tab-audio missing hints). */
export function screenshareStreamIsBrowserTab(
  stream: MediaStream | null | undefined,
): boolean {
  const track = stream?.getVideoTracks()[0];
  if (!track) return false;
  const settings = track.getSettings?.() as
    | { displaySurface?: string }
    | undefined;
  return settings?.displaySurface === 'browser';
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
  surfaceMode: CallScreenshareSurfaceMode = DEFAULT_SCREENSHARE_SURFACE_MODE,
): Promise<T> {
  const handler = client?.getMediaHandler?.() as
    | MediaHandlerWithConstraints
    | undefined;

  const patchConstraints = (opts: IScreensharingOpts) =>
    buildDisplayMediaConstraints(opts, surfaceMode);

  if (handler?.getScreenshareContraints) {
    const original = handler.getScreenshareContraints.bind(handler);
    handler.getScreenshareContraints = patchConstraints;
    try {
      return await run();
    } finally {
      handler.getScreenshareContraints = original;
    }
  }

  const mediaDevices = globalThis.navigator?.mediaDevices;
  const originalGetDisplayMedia =
    mediaDevices?.getDisplayMedia?.bind(mediaDevices);
  if (!mediaDevices || !originalGetDisplayMedia) {
    return run();
  }

  mediaDevices.getDisplayMedia = (() =>
    originalGetDisplayMedia(
      patchConstraints(
        MATRIX_SCREENSHARE_CAPTURE_OPTS,
      ) as MediaStreamConstraints,
    )) as typeof mediaDevices.getDisplayMedia;

  try {
    return await run();
  } finally {
    mediaDevices.getDisplayMedia = originalGetDisplayMedia;
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
