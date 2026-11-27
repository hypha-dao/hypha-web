/**
 * Runs the background effect (#2563) on a LiveKit camera track with `@livekit/track-processors`.
 * The package (and MediaPipe) is imported only when an effect is first used.
 */

import type { LocalVideoTrack, Room as LiveKitRoom } from 'livekit-client';
import { Track } from 'livekit-client';
import type {
  BackgroundProcessorWrapper,
  FrameProcessingStats,
} from '@livekit/track-processors';
import {
  CALL_BACKGROUND_ASSET_PATHS,
  type CallBackgroundEffect,
  processorModeForEffect,
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
};

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

async function createProcessor(
  effect: CallBackgroundEffect,
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
      ...processorModeForEffect(effect),
      assetPaths: { ...CALL_BACKGROUND_ASSET_PATHS },
      onFrameProcessed: hooks.onFrameProcessed,
    },
    CALL_BACKGROUND_PROCESSOR_NAME,
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new CallBackgroundEffectError(
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

/**
 * Attaches a new processor to `track` and waits until it runs. Throws
 * {@link CallBackgroundEffectError} on any failure; the track itself is left as it was.
 */
export async function attachCallBackgroundProcessor(
  track: LocalVideoTrack,
  effect: CallBackgroundEffect,
  hooks: CallBackgroundProcessorHooks = {},
): Promise<void> {
  let processor: BackgroundProcessorWrapper | null = null;
  try {
    processor = await createProcessor(effect, hooks);
    await withTimeout(
      track.setProcessor(processor),
      PROCESSOR_START_TIMEOUT_MS,
    );
  } catch (err) {
    if (processor && track.getProcessor() === processor) {
      await track.stopProcessor().catch(() => undefined);
    } else {
      await processor?.destroy().catch(() => undefined);
    }
    throw err instanceof CallBackgroundEffectError
      ? err
      : new CallBackgroundEffectError('Background effect failed to start', err);
  }
}

/** Changes the effect on a track that already has our processor (no restart, no artifacts). */
export async function switchCallBackgroundEffect(
  track: LocalVideoTrack,
  effect: CallBackgroundEffect,
): Promise<boolean> {
  const processor = getCallBackgroundProcessor(track);
  if (!processor) return false;
  await processor.switchTo(processorModeForEffect(effect));
  return true;
}

/**
 * Creates the camera track as `setCameraEnabled(true)` would (same room capture defaults), with
 * the effect running before anything is published. On failure the new track is stopped and a
 * {@link CallBackgroundEffectError} is thrown, so the camera stays off.
 */
export async function createCameraTrackWithBackgroundEffect(
  lkRoom: LiveKitRoom,
  effect: CallBackgroundEffect,
  hooks: CallBackgroundProcessorHooks = {},
): Promise<LocalVideoTrack> {
  const tracks = await lkRoom.localParticipant.createTracks({ video: true });
  const track = tracks.find(
    (t): t is LocalVideoTrack => t.kind === Track.Kind.Video,
  );
  tracks.filter((t) => t !== track).forEach((t) => t.stop());
  if (!track) {
    throw new CallBackgroundEffectError('No camera track was created');
  }
  try {
    await attachCallBackgroundProcessor(track, effect, hooks);
  } catch (err) {
    track.stop();
    throw err;
  }
  return track;
}
