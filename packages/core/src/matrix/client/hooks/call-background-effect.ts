/**
 * Background effect on the local camera in calls (#2563): the member's choice, how it is stored,
 * whether the browser can run it, and when the processing is too slow. Pure logic only; the
 * processor itself is in `call-background-processor.ts` and loaded on first use.
 */

export type CallBackgroundEffect =
  | { kind: 'none' }
  /** Background blur; light when no strength is given. */
  | { kind: 'blur'; strength?: CallBackgroundBlurStrength }
  /** A built-in image from {@link CALL_BACKGROUND_IMAGES}. */
  | { kind: 'image'; imageId: string }
  /** The call's space: its accent colours, logo and the Hypha mark, drawn at call time. */
  | { kind: 'space' }
  /** An image the member added, kept in this browser only (IndexedDB). */
  | { kind: 'upload'; uploadId: string };

/** Images that exist only at runtime, for {@link processorModeForEffect}. */
export type CallBackgroundEffectContext = {
  /** Drawn background of the call's space (`blob:` URL), when ready. */
  spaceImageSrc?: string | null;
  /** The member's images on this device by id (`blob:` URLs), once loaded. */
  uploadImageSrcs?: Readonly<Record<string, string>> | null;
};

/** A built-in background image (served from `apps/web/public/call-backgrounds/`). */
export type CallBackgroundImage = {
  id: string;
  src: string;
  thumbnailSrc: string;
};

/**
 * Built-in images (callout 1): the Hypha mycelium field as on the member home, light and dark.
 * Sources and licences: `apps/web/public/call-backgrounds/CREDITS.md`.
 * Adding one: the image (1920x1080), a thumbnail (`-thumb`, 320x180), an entry here, a label
 * key in `call-background-effect-menu` and the 8 locale files.
 */
export const CALL_BACKGROUND_IMAGES: readonly CallBackgroundImage[] = [
  {
    id: 'light',
    src: '/call-backgrounds/mycelium-light.jpg',
    thumbnailSrc: '/call-backgrounds/mycelium-light-thumb.jpg',
  },
  {
    id: 'dark',
    src: '/call-backgrounds/mycelium-dark.jpg',
    thumbnailSrc: '/call-backgrounds/mycelium-dark-thumb.jpg',
  },
];

export function findCallBackgroundImage(
  imageId: string,
): CallBackgroundImage | undefined {
  return CALL_BACKGROUND_IMAGES.find((image) => image.id === imageId);
}

/** Where the effect stands on the current camera track. */
export type CallBackgroundEffectStatus =
  /** No effect on the camera now (none chosen, or the camera is off). */
  | 'idle'
  /** Loading the model or starting the processor; the camera is not published meanwhile. */
  | 'applying'
  /** The effect runs on the published camera. */
  | 'active'
  /** The effect could not start; a new camera track stays off (privacy first). */
  | 'failed';

export const CALL_BACKGROUND_EFFECT_NONE: CallBackgroundEffect = {
  kind: 'none',
};

export const CALL_BACKGROUND_EFFECT_STORAGE_KEY =
  'hypha-group-call-background-effect-v1';

export type CallBackgroundBlurStrength = 'light' | 'strong';

/**
 * Blur sigma per strength, in texels of the package's 4x downsampled frame. The package keeps at
 * most 16 taps each side, so the strong value spreads the weight evenly over that whole width.
 */
export const CALL_BACKGROUND_BLUR_RADII: Record<
  CallBackgroundBlurStrength,
  number
> = { light: 10, strong: 28 };

/** Light blur radius (the package default). */
export const CALL_BACKGROUND_BLUR_RADIUS = CALL_BACKGROUND_BLUR_RADII.light;

/** Used while an image is missing or not ready: strong, so the room stays hidden. */
export const CALL_BACKGROUND_FALLBACK_BLUR: CallBackgroundEffect = {
  kind: 'blur',
  strength: 'strong',
};

export function callBackgroundBlurStrength(
  effect: CallBackgroundEffect,
): CallBackgroundBlurStrength | null {
  return effect.kind === 'blur' ? effect.strength ?? 'light' : null;
}

/**
 * Exact `@mediapipe/tasks-vision` version `@livekit/track-processors` pins. The WASM files are
 * served from our own domain under this version (`apps/web/scripts/copy-call-effect-assets.mjs`);
 * a unit test fails if the installed version moves.
 */
export const MEDIAPIPE_TASKS_VISION_VERSION = '0.10.14';

/**
 * Self-hosted assets, so no CDN request and no CSP change (callout 5). The WASM is copied on
 * install; the model is committed (see `apps/web/scripts/copy-call-effect-assets.mjs`).
 */
export const CALL_BACKGROUND_ASSET_PATHS = {
  tasksVisionFileSet: `/vendor/mediapipe/tasks-vision-${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`,
  modelAssetPath: '/vendor/mediapipe/models/selfie_segmenter-float16-v1.tflite',
} as const;

export function isCallBackgroundEffectActive(
  effect: CallBackgroundEffect,
): boolean {
  return effect.kind !== 'none';
}

export function callBackgroundEffectsEqual(
  a: CallBackgroundEffect,
  b: CallBackgroundEffect,
): boolean {
  if (a.kind === 'blur' && b.kind === 'blur') {
    return callBackgroundBlurStrength(a) === callBackgroundBlurStrength(b);
  }
  if (a.kind === 'image' && b.kind === 'image') return a.imageId === b.imageId;
  if (a.kind === 'upload' && b.kind === 'upload') {
    return a.uploadId === b.uploadId;
  }
  return a.kind === b.kind;
}

export function serializeCallBackgroundEffect(
  effect: CallBackgroundEffect,
): string {
  if (effect.kind === 'blur') {
    return effect.strength === 'strong' ? 'blur:strong' : 'blur';
  }
  if (effect.kind === 'image') return `image:${effect.imageId}`;
  if (effect.kind === 'upload') return `upload:${effect.uploadId}`;
  return effect.kind;
}

/**
 * Unknown or malformed values fall back to no effect. An image that no longer exists (removed in a
 * later release) falls back to blur: the member chose to hide their room, so keep it hidden.
 */
export function parseCallBackgroundEffect(
  raw: string | null | undefined,
): CallBackgroundEffect {
  const value = raw?.trim();
  if (value === 'blur') return { kind: 'blur' };
  if (value === 'blur:strong') return { kind: 'blur', strength: 'strong' };
  if (value === 'space') return { kind: 'space' };
  if (value?.startsWith('upload:')) {
    const uploadId = value.slice('upload:'.length);
    // Whether it still exists is known only once this browser's images are loaded.
    return uploadId
      ? { kind: 'upload', uploadId }
      : CALL_BACKGROUND_FALLBACK_BLUR;
  }
  if (value?.startsWith('image:')) {
    const imageId = value.slice('image:'.length);
    return findCallBackgroundImage(imageId)
      ? { kind: 'image', imageId }
      : CALL_BACKGROUND_FALLBACK_BLUR;
  }
  return CALL_BACKGROUND_EFFECT_NONE;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredCallBackgroundEffect(
  storage: StorageLike | null = defaultStorage(),
): CallBackgroundEffect {
  if (!storage) return CALL_BACKGROUND_EFFECT_NONE;
  try {
    return parseCallBackgroundEffect(
      storage.getItem(CALL_BACKGROUND_EFFECT_STORAGE_KEY),
    );
  } catch {
    return CALL_BACKGROUND_EFFECT_NONE;
  }
}

export function persistCallBackgroundEffect(
  effect: CallBackgroundEffect,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      CALL_BACKGROUND_EFFECT_STORAGE_KEY,
      serializeCallBackgroundEffect(effect),
    );
  } catch {
    // ignore persistence write failures (private mode, quota)
  }
}

/** Options for the processor's `switchTo`, without importing the package. */
export type CallBackgroundProcessorMode =
  | { mode: 'disabled' }
  | { mode: 'background-blur'; blurRadius: number }
  | { mode: 'virtual-background'; imagePath: string };

const FALLBACK_BLUR_MODE: CallBackgroundProcessorMode = {
  mode: 'background-blur',
  blurRadius: CALL_BACKGROUND_BLUR_RADII.strong,
};

/**
 * The processor mode for an effect. An image that is missing (unknown built-in, space background
 * not drawn yet) resolves to blur, so the room stays hidden until the image is there.
 */
export function processorModeForEffect(
  effect: CallBackgroundEffect,
  context: CallBackgroundEffectContext = {},
): CallBackgroundProcessorMode {
  switch (effect.kind) {
    case 'upload': {
      const src = context.uploadImageSrcs?.[effect.uploadId];
      return src
        ? { mode: 'virtual-background', imagePath: src }
        : FALLBACK_BLUR_MODE;
    }
    case 'space':
      return context.spaceImageSrc
        ? { mode: 'virtual-background', imagePath: context.spaceImageSrc }
        : FALLBACK_BLUR_MODE;
    case 'blur':
      return {
        mode: 'background-blur',
        blurRadius: CALL_BACKGROUND_BLUR_RADII[effect.strength ?? 'light'],
      };
    case 'image': {
      const image = findCallBackgroundImage(effect.imageId);
      return image
        ? { mode: 'virtual-background', imagePath: image.src }
        : FALLBACK_BLUR_MODE;
    }
    case 'none':
    default:
      return { mode: 'disabled' };
  }
}

type SupportEnv = {
  OffscreenCanvas?: unknown;
  VideoFrame?: unknown;
  createImageBitmap?: unknown;
  MediaStreamTrackProcessor?: unknown;
  MediaStreamTrackGenerator?: unknown;
  HTMLCanvasElement?: { prototype: object };
  document?: { createElement: (tag: 'canvas') => HTMLCanvasElement };
};

/**
 * Same test as `supportsBackgroundProcessors()` in `@livekit/track-processors@0.8.3`
 * (`BackgroundTransformer.isSupported && ProcessorWrapper.isSupported`), so the control can be
 * hidden without loading the package. The package's own check still runs before use.
 */
export function supportsCallBackgroundEffects(
  env: SupportEnv | undefined = typeof window === 'undefined'
    ? undefined
    : (window as unknown as SupportEnv),
): boolean {
  if (!env?.document) return false;
  try {
    const transformerSupported =
      typeof env.OffscreenCanvas !== 'undefined' &&
      typeof env.VideoFrame !== 'undefined' &&
      typeof env.createImageBitmap !== 'undefined' &&
      !!env.document.createElement('canvas').getContext('webgl2');
    if (!transformerSupported) return false;
    const hasStreamProcessor =
      typeof env.MediaStreamTrackProcessor !== 'undefined' &&
      typeof env.MediaStreamTrackGenerator !== 'undefined';
    const hasFallback =
      typeof env.HTMLCanvasElement !== 'undefined' &&
      'captureStream' in env.HTMLCanvasElement.prototype;
    return hasStreamProcessor || hasFallback;
  } catch {
    return false;
  }
}

/**
 * Flags frame drops from the processor's per-frame timings (callout 4: always offered, warn when
 * slow). Slow when the average over `windowSize` frames exceeds `slowAboveMs`; clears only below
 * `recoverBelowMs` so the warning does not flicker.
 */
export function createCallBackgroundFrameDropDetector({
  windowSize = 30,
  slowAboveMs = 45,
  recoverBelowMs = 30,
}: {
  windowSize?: number;
  slowAboveMs?: number;
  recoverBelowMs?: number;
} = {}) {
  let samples: number[] = [];
  let sum = 0;
  let slow = false;
  return {
    /** Records one frame's processing time; returns whether processing is currently slow. */
    record(processingTimeMs: number): boolean {
      if (!Number.isFinite(processingTimeMs) || processingTimeMs < 0) {
        return slow;
      }
      samples.push(processingTimeMs);
      sum += processingTimeMs;
      if (samples.length > windowSize) {
        sum -= samples.shift() ?? 0;
      }
      if (samples.length < windowSize) return slow;
      const average = sum / samples.length;
      if (!slow && average > slowAboveMs) slow = true;
      else if (slow && average < recoverBelowMs) slow = false;
      return slow;
    },
    reset() {
      samples = [];
      sum = 0;
      slow = false;
    },
    get isSlow() {
      return slow;
    },
  };
}
