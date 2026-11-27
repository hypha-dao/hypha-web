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
  CALL_BACKGROUND_BLUR_RADIUS,
  type CallBackgroundProcessorMode,
} from './call-background-effect';

/** Name of our processor on the track, to tell it apart from any other processor. */
export const CALL_BACKGROUND_PROCESSOR_NAME = 'hypha-background-effect';

/** First use downloads ~9.4 MB of WASM; beyond this the effect counts as failed. */
const PROCESSOR_START_TIMEOUT_MS = 20_000;

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
 * is a {@link CallBackgroundImageError} instead. Loaded as the package loads it (anonymous CORS),
 * so it is cached.
 */
async function preloadEffectImage(
  mode: CallBackgroundProcessorMode,
): Promise<void> {
  if (mode.mode !== 'virtual-background') return;
  try {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = mode.imagePath;
    await img.decode();
  } catch (err) {
    throw new CallBackgroundImageError(
      `Background image failed to load: ${mode.imagePath}`,
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
  await preloadEffectImage(mode);
  if (!shouldCommit()) return false;
  let processor: BackgroundProcessorWrapper | null = null;
  try {
    processor = await createProcessor(mode, hooks);
    const pending = track.setProcessor(processor);
    try {
      await withTimeout(pending, PROCESSOR_START_TIMEOUT_MS);
    } catch (err) {
      if (err instanceof CallBackgroundTimeoutError) {
        // 0.8.3 ignores destroy() while initializing, and livekit-client can still finish the
        // pending setProcessor later and swap the outgoing track. Remove it when that happens.
        const late = processor;
        void pending.then(
          async () => {
            if (track.getProcessor() !== late) return;
            await track.stopProcessor().catch(() => undefined);
            hooks.onLateStartRemoved?.();
          },
          () => undefined,
        );
      }
      throw err;
    }
    return true;
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
}

/**
 * Changes the effect on a track that already has our processor (no restart, no artifacts). Returns
 * false when the track has no processor of ours or `shouldCommit` said no after the image loaded.
 * Throws {@link CallBackgroundImageError} when the image cannot load and
 * {@link CallBackgroundEffectError} when the switch fails; the previous effect then stays.
 */
export async function switchCallBackgroundEffect(
  track: LocalVideoTrack,
  mode: CallBackgroundProcessorMode,
  shouldCommit: CallBackgroundCommitCheck = () => true,
): Promise<boolean> {
  const processor = getCallBackgroundProcessor(track);
  if (!processor) return false;
  await preloadEffectImage(mode);
  if (!shouldCommit() || getCallBackgroundProcessor(track) !== processor) {
    return false;
  }
  try {
    await processor.switchTo(mode);
  } catch (err) {
    throw new CallBackgroundEffectError(
      'Background effect failed to switch',
      err,
    );
  }
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
