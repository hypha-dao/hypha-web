import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  CALL_BACKGROUND_ASSET_PATHS,
  CALL_BACKGROUND_BLUR_RADIUS,
  CALL_BACKGROUND_EFFECT_STORAGE_KEY,
  CALL_BACKGROUND_IMAGES,
  findCallBackgroundImage,
  callBackgroundEffectsEqual,
  createCallBackgroundFrameDropDetector,
  isCallBackgroundEffectActive,
  MEDIAPIPE_TASKS_VISION_VERSION,
  parseCallBackgroundEffect,
  persistCallBackgroundEffect,
  processorModeForEffect,
  readStoredCallBackgroundEffect,
  serializeCallBackgroundEffect,
  supportsCallBackgroundEffects,
} from '../call-background-effect';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    data,
  };
}

describe('parse / serialize', () => {
  it('round-trips each effect', () => {
    for (const effect of [{ kind: 'none' }, { kind: 'blur' }] as const) {
      expect(
        parseCallBackgroundEffect(serializeCallBackgroundEffect(effect)),
      ).toEqual(effect);
    }
  });

  it.each([null, undefined, '', 'nonsense', 'BLUR', 'image'])(
    'falls back to none for %p',
    (raw) => {
      expect(parseCallBackgroundEffect(raw)).toEqual({ kind: 'none' });
    },
  );

  it('trims whitespace', () => {
    expect(parseCallBackgroundEffect(' blur \n')).toEqual({ kind: 'blur' });
  });
});

describe('storage', () => {
  it('reads and writes under the versioned key', () => {
    const storage = memoryStorage();
    persistCallBackgroundEffect({ kind: 'blur' }, storage);
    expect(storage.data.get(CALL_BACKGROUND_EFFECT_STORAGE_KEY)).toBe('blur');
    expect(readStoredCallBackgroundEffect(storage)).toEqual({ kind: 'blur' });
  });

  it('defaults to none with nothing stored or no storage', () => {
    expect(readStoredCallBackgroundEffect(memoryStorage())).toEqual({
      kind: 'none',
    });
    expect(readStoredCallBackgroundEffect(null)).toEqual({ kind: 'none' });
  });

  it('swallows storage errors', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(readStoredCallBackgroundEffect(throwing)).toEqual({ kind: 'none' });
    expect(() =>
      persistCallBackgroundEffect({ kind: 'blur' }, throwing),
    ).not.toThrow();
  });
});

describe('effect helpers', () => {
  it('knows which effects are active', () => {
    expect(isCallBackgroundEffectActive({ kind: 'none' })).toBe(false);
    expect(isCallBackgroundEffectActive({ kind: 'blur' })).toBe(true);
  });

  it('compares effects', () => {
    expect(callBackgroundEffectsEqual({ kind: 'blur' }, { kind: 'blur' })).toBe(
      true,
    );
    expect(callBackgroundEffectsEqual({ kind: 'blur' }, { kind: 'none' })).toBe(
      false,
    );
  });

  it('maps effects to processor modes', () => {
    expect(processorModeForEffect({ kind: 'none' })).toEqual({
      mode: 'disabled',
    });
    expect(processorModeForEffect({ kind: 'blur' })).toEqual({
      mode: 'background-blur',
      blurRadius: CALL_BACKGROUND_BLUR_RADIUS,
    });
  });
});

describe('supportsCallBackgroundEffects', () => {
  const canvasWith = (webgl2: boolean) =>
    ({
      getContext: (kind: string) => (kind === 'webgl2' && webgl2 ? {} : null),
    } as unknown as HTMLCanvasElement);
  const base = (webgl2 = true) => ({
    OffscreenCanvas: class {},
    VideoFrame: class {},
    createImageBitmap: () => undefined,
    document: { createElement: () => canvasWith(webgl2) },
  });

  it('is false without a window', () => {
    expect(supportsCallBackgroundEffects(undefined)).toBe(false);
  });

  it('accepts insertable streams (Chromium)', () => {
    expect(
      supportsCallBackgroundEffects({
        ...base(),
        MediaStreamTrackProcessor: class {},
        MediaStreamTrackGenerator: class {},
      }),
    ).toBe(true);
  });

  it('accepts the canvas.captureStream fallback (Firefox / Safari)', () => {
    expect(
      supportsCallBackgroundEffects({
        ...base(),
        HTMLCanvasElement: { prototype: { captureStream: () => undefined } },
      }),
    ).toBe(true);
  });

  it('rejects without WebGL2, VideoFrame or any frame path', () => {
    expect(
      supportsCallBackgroundEffects({
        ...base(false),
        HTMLCanvasElement: { prototype: { captureStream: () => undefined } },
      }),
    ).toBe(false);
    expect(
      supportsCallBackgroundEffects({
        ...base(),
        VideoFrame: undefined,
        HTMLCanvasElement: { prototype: { captureStream: () => undefined } },
      }),
    ).toBe(false);
    expect(supportsCallBackgroundEffects(base())).toBe(false);
  });

  it('treats a throwing canvas as unsupported', () => {
    expect(
      supportsCallBackgroundEffects({
        ...base(),
        document: {
          createElement: () => {
            throw new Error('no canvas');
          },
        },
      }),
    ).toBe(false);
  });
});

describe('createCallBackgroundFrameDropDetector', () => {
  const opts = { windowSize: 4, slowAboveMs: 45, recoverBelowMs: 30 };

  it('waits for a full window before judging', () => {
    const d = createCallBackgroundFrameDropDetector(opts);
    expect([100, 100, 100].map((ms) => d.record(ms))).toEqual([
      false,
      false,
      false,
    ]);
    expect(d.record(100)).toBe(true);
  });

  it('turns slow above the threshold and recovers only below the lower one', () => {
    const d = createCallBackgroundFrameDropDetector(opts);
    [50, 50, 50, 50].forEach((ms) => d.record(ms));
    expect(d.isSlow).toBe(true);
    // Average 40 ms: between the thresholds, stays slow (no flicker).
    [40, 40, 40, 40].forEach((ms) => d.record(ms));
    expect(d.isSlow).toBe(true);
    [20, 20, 20, 20].forEach((ms) => d.record(ms));
    expect(d.isSlow).toBe(false);
  });

  it('uses a rolling window', () => {
    const d = createCallBackgroundFrameDropDetector(opts);
    [10, 10, 10, 10].forEach((ms) => d.record(ms));
    expect(d.isSlow).toBe(false);
    [100, 100, 100].forEach((ms) => d.record(ms));
    // Window is 10, 100, 100, 100 -> 77.5 ms average.
    expect(d.isSlow).toBe(true);
  });

  it('ignores invalid samples and resets', () => {
    const d = createCallBackgroundFrameDropDetector(opts);
    [NaN, -1, Infinity].forEach((ms) => d.record(ms));
    [60, 60, 60].forEach((ms) => d.record(ms));
    expect(d.isSlow).toBe(false);
    d.record(60);
    expect(d.isSlow).toBe(true);
    d.reset();
    expect(d.isSlow).toBe(false);
  });
});

describe('self-hosted assets', () => {
  it('match the MediaPipe version @livekit/track-processors pins', () => {
    const require = createRequire(import.meta.url);
    const manifest = require('@livekit/track-processors/package.json') as {
      dependencies: Record<string, string>;
    };
    expect(manifest.dependencies['@mediapipe/tasks-vision']).toBe(
      MEDIAPIPE_TASKS_VISION_VERSION,
    );
    expect(CALL_BACKGROUND_ASSET_PATHS.tasksVisionFileSet).toBe(
      `/vendor/mediapipe/tasks-vision-${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`,
    );
  });
});

describe('built-in images', () => {
  const first = CALL_BACKGROUND_IMAGES[0]!;

  it('has unique ids and same-origin paths with thumbnails', () => {
    const ids = CALL_BACKGROUND_IMAGES.map((image) => image.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const image of CALL_BACKGROUND_IMAGES) {
      expect(image.src).toMatch(/^\/call-backgrounds\/[a-z0-9-]+\.(jpg|webp)$/);
      expect(image.thumbnailSrc).toMatch(
        /^\/call-backgrounds\/[a-z0-9-]+-thumb\.(jpg|webp)$/,
      );
      expect(findCallBackgroundImage(image.id)).toBe(image);
    }
  });

  it('round-trips an image effect', () => {
    const effect = { kind: 'image', imageId: first.id } as const;
    expect(serializeCallBackgroundEffect(effect)).toBe(`image:${first.id}`);
    expect(parseCallBackgroundEffect(`image:${first.id}`)).toEqual(effect);
  });

  it('falls back to blur for an image that no longer exists', () => {
    expect(parseCallBackgroundEffect('image:removed-in-a-release')).toEqual({
      kind: 'blur',
    });
    expect(parseCallBackgroundEffect('image:')).toEqual({ kind: 'blur' });
  });

  it('maps images to the virtual background mode', () => {
    expect(
      processorModeForEffect({ kind: 'image', imageId: first.id }),
    ).toEqual({ mode: 'virtual-background', imagePath: first.src });
    expect(
      processorModeForEffect({ kind: 'image', imageId: 'unknown' }),
    ).toEqual({
      mode: 'background-blur',
      blurRadius: CALL_BACKGROUND_BLUR_RADIUS,
    });
  });

  it('compares image effects by id', () => {
    expect(
      callBackgroundEffectsEqual(
        { kind: 'image', imageId: 'a' },
        { kind: 'image', imageId: 'a' },
      ),
    ).toBe(true);
    expect(
      callBackgroundEffectsEqual(
        { kind: 'image', imageId: 'a' },
        { kind: 'image', imageId: 'b' },
      ),
    ).toBe(false);
    expect(isCallBackgroundEffectActive({ kind: 'image', imageId: 'a' })).toBe(
      true,
    );
  });
});
