/** Legacy app shell wrapper (includes side panels). */
export const HYPHA_SCREEN_SHARE_CAPTURE_ROOT_ID =
  'hypha-screen-share-capture-root';

/**
 * Main content column — tab capture is cropped here so Human Chat / call UI in the
 * right sidebar is not transmitted to remote participants.
 */
export const HYPHA_SCREEN_SHARE_MAIN_CONTENT_ID =
  'hypha-screen-share-main-content';

/** Opaque handle from Element Capture `RestrictionTarget.fromElement` (not in all TS DOM libs). */
type ScreenShareRestrictionTarget = object;

type RestrictableMediaStreamTrack = MediaStreamTrack & {
  restrictTo?: (target: ScreenShareRestrictionTarget | null) => Promise<void>;
};

function getCaptureRootElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return (
    document.getElementById(HYPHA_SCREEN_SHARE_MAIN_CONTENT_ID) ??
    document.getElementById(HYPHA_SCREEN_SHARE_CAPTURE_ROOT_ID)
  );
}

function isTabCaptureTrack(track: MediaStreamTrack): boolean {
  const settings = track.getSettings?.() as
    | { displaySurface?: string }
    | undefined;
  return settings?.displaySurface === 'browser';
}

/**
 * Crop tab self-capture to the main content column so side panels, call chrome,
 * and the floating call dock are not transmitted to remote participants.
 */
export async function applyScreenShareCaptureRootRestriction(
  stream: MediaStream | null | undefined,
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const root = getCaptureRootElement();
  if (!root) return false;

  const RestrictionTargetCtor = (
    globalThis as typeof globalThis & {
      RestrictionTarget?: {
        fromElement: (
          element: Element,
        ) => Promise<ScreenShareRestrictionTarget>;
      };
    }
  ).RestrictionTarget;
  if (!RestrictionTargetCtor?.fromElement) return false;

  const [track] = stream?.getVideoTracks() ?? [];
  if (!track || track.readyState !== 'live') return false;
  if (!isTabCaptureTrack(track)) return false;

  const restrictable = track as RestrictableMediaStreamTrack;
  if (typeof restrictable.restrictTo !== 'function') return false;

  try {
    const target = await RestrictionTargetCtor.fromElement(root);
    await restrictable.restrictTo(target);
    return true;
  } catch (error) {
    console.debug(
      '[screenshare] Failed to restrict tab capture to app shell:',
      error,
    );
    return false;
  }
}

export async function clearScreenShareCaptureRootRestriction(
  stream: MediaStream | null | undefined,
): Promise<void> {
  const [track] = stream?.getVideoTracks() ?? [];
  if (!track) return;
  const restrictable = track as RestrictableMediaStreamTrack;
  if (typeof restrictable.restrictTo !== 'function') return;
  try {
    await restrictable.restrictTo(null);
  } catch {
    // ignore — track may already be stopped
  }
}

export async function applyScreenShareCaptureRootRestrictionWithRetry(
  stream: MediaStream | null | undefined,
  attempts = 8,
  delayMs = 150,
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await applyScreenShareCaptureRootRestriction(stream)) return;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
