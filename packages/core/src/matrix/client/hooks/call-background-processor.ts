/**
 * Runs the background effect (#2563) on a LiveKit camera track with `@livekit/track-processors`.
 * The package (and MediaPipe) is imported only when an effect is first used. Functions take the
 * resolved processor mode (`processorModeForEffect`), since some images exist only at runtime.
 */

import type { LocalVideoTrack } from 'livekit-client';
import { LocalVideoTrack as LiveKitLocalVideoTrack } from 'livekit-client';
import type {
  BackgroundProcessorWrapper,
  FrameProcessingStats,
} from '@livekit/track-processors';
import {
  CALL_BACKGROUND_ASSET_PATHS,
  CALL_BACKGROUND_BLUR_RADII,
  CALL_BACKGROUND_BLUR_RADIUS,
  type CallBackgroundProcessorMode,
} from './call-background-effect';

/** Name of our processor on the track, to tell it apart from any other processor. */
export const CALL_BACKGROUND_PROCESSOR_NAME = 'hypha-background-effect';

/** First use downloads ~9.4 MB of WASM; beyond this the effect counts as failed. */
const PROCESSOR_START_TIMEOUT_MS = 20_000;
/** A background image that takes longer counts as broken (strong blur instead). */
const IMAGE_LOAD_TIMEOUT_MS = 15_000;
/** How often a pending image load checks whether a newer choice replaced it. */
const SUPERSEDED_POLL_MS = 100;

/** A processor starts in strong blur; an image is switched to once it runs. */
const START_MODE: CallBackgroundProcessorMode = {
  mode: 'background-blur',
  blurRadius: CALL_BACKGROUND_BLUR_RADII.strong,
};

export class CallBackgroundEffectError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'CallBackgroundEffectError';
    Object.assign(this, { cause });
  }
}

/** A background image could not be loaded or decoded (the processor itself may be fine). */
export class CallBackgroundImageError extends CallBackgroundEffectError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'CallBackgroundImageError';
  }
}

type TrackProcessorsModule = typeof import('@livekit/track-processors');

let trackProcessorsModule: Promise<TrackProcessorsModule> | null = null;

function loadTrackProcessors(): Promise<TrackProcessorsModule> {
  trackProcessorsModule ??= import('@livekit/track-processors').catch((err) => {
    trackProcessorsModule = null;
    throw err;
  });
  return trackProcessorsModule;
}

export type CallBackgroundProcessorHooks = {
  onFrameProcessed?: (stats: FrameProcessingStats) => void;
  /**
   * A start that timed out finished later and was removed again (it would otherwise replace the
   * outgoing track behind the caller's back). The caller may reconcile.
   */
  onLateStartRemoved?: () => void;
};

/** Checked after an image has loaded and before it is applied; false drops superseded work. */
export type CallBackgroundCommitCheck = () => boolean;

/** Our processor on the track, if any. */
export function getCallBackgroundProcessor(
  track: LocalVideoTrack | undefined | null,
): BackgroundProcessorWrapper | null {
  const processor = track?.getProcessor() as
    | (BackgroundProcessorWrapper & { name?: string })
    | undefined;
  if (!processor || processor.name !== CALL_BACKGROUND_PROCESSOR_NAME) {
    return null;
  }
  return typeof processor.switchTo === 'function' ? processor : null;
}

/**
 * Loads and decodes a background image before the processor gets it. The package only logs a
 * failed image load and would keep rendering without it, which could show the room; a failure here
 * is a {@link CallBackgroundImageError} instead (also after {@link IMAGE_LOAD_TIMEOUT_MS}). Loaded
 * as the package loads it (anonymous CORS), so it is cached. Resolves `superseded` as soon as a
 * newer choice replaced this one, so a stalled image never holds up the next pass.
 */
async function preloadEffectImage(
  mode: CallBackgroundProcessorMode,
  shouldCommit: CallBackgroundCommitCheck,
): Promise<'loaded' | 'superseded'> {
  if (mode.mode !== 'virtual-background') return 'loaded';
  let poll: ReturnType<typeof setInterval> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = mode.imagePath;
    return await Promise.race([
      img.decode().then(() => 'loaded' as const),
      // A newer choice releases the pass at once instead of waiting for this image.
      new Promise<'superseded'>((resolve) => {
        poll = setInterval(() => {
          if (!shouldCommit()) resolve('superseded');
        }, SUPERSEDED_POLL_MS);
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`no image after ${IMAGE_LOAD_TIMEOUT_MS} ms`)),
          IMAGE_LOAD_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (err) {
    throw new CallBackgroundImageError(
      `Background image failed to load: ${mode.imagePath}`,
      err,
    );
  } finally {
    if (poll) clearInterval(poll);
    if (timer) clearTimeout(timer);
  }
}

/** Applies a mode on a running processor; a failed image mode is an image error. */
async function applyMode(
  processor: BackgroundProcessorWrapper,
  mode: CallBackgroundProcessorMode,
) {
  try {
    await processor.switchTo(mode);
  } catch (err) {
    // The package loads the image again itself (`loadAndSetBackground`); it can still fail
    // (revoked blob, decode error) after our preload passed.
    throw mode.mode === 'virtual-background'
      ? new CallBackgroundImageError('Background image failed to apply', err)
      : new CallBackgroundEffectError(
          'Background effect failed to switch',
          err,
        );
  }
}

async function createProcessor(
  mode: CallBackgroundProcessorMode,
  hooks: CallBackgroundProcessorHooks,
): Promise<BackgroundProcessorWrapper> {
  const mod = await loadTrackProcessors();
  if (!mod.supportsBackgroundProcessors()) {
    throw new CallBackgroundEffectError(
      'Background effects are not supported in this browser',
    );
  }
  return mod.BackgroundProcessor(
    {
      ...mode,
      assetPaths: { ...CALL_BACKGROUND_ASSET_PATHS },
      onFrameProcessed: hooks.onFrameProcessed,
    },
    CALL_BACKGROUND_PROCESSOR_NAME,
  );
}

class CallBackgroundTimeoutError extends CallBackgroundEffectError {}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new CallBackgroundTimeoutError(
                `Background effect did not start within ${ms} ms`,
              ),
            ),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let warmUpPromise: Promise<void> | null = null;

/**
 * Attaches a new processor to `track` and waits until it runs. Returns false when `shouldCommit`
 * said no after the image loaded (superseded). Throws {@link CallBackgroundEffectError} (or
 * {@link CallBackgroundImageError}) on failure; the track itself is left as it was. A warm-up in
 * progress loads the same assets; it is awaited instead of starting a second segmenter.
 */
export async function attachCallBackgroundProcessor(
  track: LocalVideoTrack,
  mode: CallBackgroundProcessorMode,
  hooks: CallBackgroundProcessorHooks = {},
  shouldCommit: CallBackgroundCommitCheck = () => true,
): Promise<boolean> {
  await warmUpPromise?.catch(() => undefined);
  return attachProcessor(track, mode, hooks, shouldCommit);
}

async function attachProcessor(
  track: LocalVideoTrack,
  mode: CallBackgroundProcessorMode,
  hooks: CallBackgroundProcessorHooks = {},
  shouldCommit: CallBackgroundCommitCheck = () => true,
): Promise<boolean> {
  if ((await preloadEffectImage(mode, shouldCommit)) === 'superseded') {
    return false;
  }
  if (!shouldCommit()) return false;
  // Start in strong blur, never in an image mode: 0.8.3 only logs an image that fails during
  // init and would then pass the room through. The image is switched to once the processor runs.
  const startMode = mode.mode === 'virtual-background' ? START_MODE : mode;
  let processor: BackgroundProcessorWrapper | null = null;
  try {
    processor = await createProcessor(startMode, hooks);
    // Loading the package can take a while on first use: check again right before attaching.
    if (!shouldCommit()) {
      await processor.destroy().catch(() => undefined);
      return false;
    }
    const pending = track.setProcessor(processor);
    try {
      await withTimeout(pending, PROCESSOR_START_TIMEOUT_MS);
    } catch (err) {
      if (err instanceof CallBackgroundTimeoutError) {
        removeLateStart(track, processor, pending, hooks);
      }
      throw err;
    }
  } catch (err) {
    if (processor && track.getProcessor() === processor) {
      await track.stopProcessor().catch(() => undefined);
    } else if (!(err instanceof CallBackgroundTimeoutError)) {
      await processor?.destroy().catch(() => undefined);
    }
    throw err instanceof CallBackgroundEffectError
      ? err
      : new CallBackgroundEffectError('Background effect failed to start', err);
  }
  if (startMode !== mode) {
    if (!shouldCommit()) return true; // running (strong blur); the next pass sets the latest
    await applyMode(processor, mode);
  }
  return true;
}

/**
 * A start that missed the deadline can still settle later: 0.8.3 ignores destroy() while
 * initializing, and livekit-client registers the processor before swapping the sender track.
 * Whatever the outcome, remove that processor from the track if it is still the one there (never a
 * newer one), else release it.
 */
function removeLateStart(
  track: LocalVideoTrack,
  late: BackgroundProcessorWrapper,
  pending: Promise<unknown>,
  hooks: CallBackgroundProcessorHooks,
) {
  const settle = async () => {
    if (track.getProcessor() === late) {
      await track.stopProcessor().catch(() => undefined);
      hooks.onLateStartRemoved?.();
    } else {
      await late.destroy().catch(() => undefined);
    }
  };
  void pending.then(settle, settle);
}

/**
 * Changes the effect on a track that already has our processor (no restart, no artifacts). Returns
 * false when the track has no processor of ours or a newer choice replaced this one while its
 * image loaded. Throws {@link CallBackgroundImageError} when the image cannot load or apply and
 * {@link CallBackgroundEffectError} when the switch fails; the previous effect then stays.
 */
export async function switchCallBackgroundEffect(
  track: LocalVideoTrack,
  mode: CallBackgroundProcessorMode,
  shouldCommit: CallBackgroundCommitCheck = () => true,
): Promise<boolean> {
  const processor = getCallBackgroundProcessor(track);
  if (!processor) return false;
  if ((await preloadEffectImage(mode, shouldCommit)) === 'superseded') {
    return false;
  }
  if (!shouldCommit() || getCallBackgroundProcessor(track) !== processor) {
    return false;
  }
  await applyMode(processor, mode);
  return true;
}

/**
 * Warms the effect up before the camera needs it (#2563): the first start in a tab takes
 * seconds (WASM compile, model load, GPU setup, first segmentation), later starts ~0.5 s. Runs the
 * processor on a hidden canvas until its first processed frame, then throws it away. No camera is
 * used and nothing is published. Called when joining with the camera and an effect saved; failures
 * are only logged (the real start reports them). Concurrent calls share one run.
 */
export function warmUpCallBackgroundEffect(): Promise<void> {
  warmUpPromise ??= (async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    let tick = 0;
    const draw = () => {
      if (!ctx) return;
      // Frames must change for captureStream to emit them.
      ctx.fillStyle = tick++ % 2 ? '#808080' : '#7f7f7f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    draw();
    const timer = setInterval(draw, 50);
    let source: MediaStreamTrack | undefined;
    let track: LiveKitLocalVideoTrack | undefined;
    try {
      source = canvas.captureStream(20).getVideoTracks()[0];
      if (!source) {
        throw new CallBackgroundEffectError(
          'canvas.captureStream gave no track',
        );
      }
      track = new LiveKitLocalVideoTrack(source, undefined, true);
      let onFirstFrame: () => void = () => undefined;
      const firstFrame = new Promise<void>((resolve) => {
        onFirstFrame = resolve;
      });
      await attachProcessor(
        track,
        { mode: 'background-blur', blurRadius: CALL_BACKGROUND_BLUR_RADIUS },
        { onFrameProcessed: () => onFirstFrame() },
      );
      await withTimeout(firstFrame, PROCESSOR_START_TIMEOUT_MS);
    } finally {
      clearInterval(timer);
      track?.stop();
      source?.stop();
    }
  })().catch((err) => {
    warmUpPromise = null;
    throw err;
  });
  return warmUpPromise;
}

/**
 * Turns the camera on without our processor after the processor failed to restart on unmute.
 * livekit-client acquires the new capture before restarting the processor and does not stop it
 * when that restart throws (`LocalTrack.setMediaStreamTrack`), so that orphaned capture is stopped
 * here; otherwise it would keep the camera running after a later mute. The stream is read before
 * `stopProcessor()`, which replaces `track.mediaStream` with the previous track (2.20.0
 * `internalStopProcessor`). The previous track was already stopped by `restart()`, so every capture
 * still live in that snapshot is the orphan.
 */
export async function recoverCameraWithoutProcessor(
  participant: { setCameraEnabled: (enabled: boolean) => Promise<unknown> },
  track: Pick<LocalVideoTrack, 'stopProcessor' | 'mediaStream'>,
  /**
   * Whether the latest camera request still wants the camera on. A newer mute makes it false; a
   * newer camera-on keeps it true, so this recovery never reverts it.
   */
  shouldBeOn: () => boolean = () => true,
): Promise<boolean> {
  const captures = track.mediaStream?.getVideoTracks() ?? [];
  await track.stopProcessor().catch(() => undefined);
  // Unconditional: the orphaned capture must never keep running.
  for (const capture of captures) {
    if (capture.readyState === 'live') capture.stop();
  }
  if (!shouldBeOn()) return false;
  await participant.setCameraEnabled(true);
  // Only a newer mute turns it off again; a newer camera-on must not be reverted.
  if (!shouldBeOn()) {
    await participant.setCameraEnabled(false);
    return false;
  }
  return true;
}
