'use client';

import { useSyncExternalStore } from 'react';
import {
  ScreenSharePresets,
  Track,
  VideoPreset,
  type LocalTrack,
  type Room,
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
  type VideoCodec,
} from 'livekit-client';

/**
 * Sharer-side screenshare settings (#2742). Everything here is fixed when a share starts (capture
 * size, frame rate, bitrate, the smaller copies sent, codec), so the choice applies to the next
 * share. Kept per browser in localStorage while we compare the options on a preview; the defaults
 * are what a share uses when nothing was chosen.
 */

export type ScreenShareMaxSize = '1080p' | '1440p' | 'native';
export type ScreenShareFrameRate = 15 | 30;
export type ScreenShareBitrateMbps = 2.5 | 4 | 6 | 8;
/** The smaller copies sent below the full size; `auto` picks them from the shared size. */
export type ScreenShareLayers =
  | 'auto'
  | '360p'
  | '360p+720p'
  | '540p+1080p'
  | '720p+1080p';
export type ScreenShareCodec = 'vp8' | 'h264' | 'vp9' | 'av1';

export type ScreenSharePublishSettings = {
  maxSize: ScreenShareMaxSize;
  frameRate: ScreenShareFrameRate;
  bitrateMbps: ScreenShareBitrateMbps;
  layers: ScreenShareLayers;
  codec: ScreenShareCodec;
};

export const SCREEN_SHARE_SETTING_CHOICES = {
  maxSize: ['1080p', '1440p', 'native'],
  frameRate: [15, 30],
  bitrateMbps: [2.5, 4, 6, 8],
  layers: ['auto', '360p', '360p+720p', '540p+1080p', '720p+1080p'],
  codec: ['vp8', 'h264', 'vp9', 'av1'],
} as const satisfies {
  [K in keyof ScreenSharePublishSettings]: ReadonlyArray<
    ScreenSharePublishSettings[K]
  >;
};

export const DEFAULT_SCREEN_SHARE_PUBLISH_SETTINGS: ScreenSharePublishSettings =
  {
    maxSize: '1440p',
    frameRate: 15,
    bitrateMbps: 4,
    layers: 'auto',
    codec: 'vp8',
  };

const CAPTURE_SIZE: Record<
  ScreenShareMaxSize,
  { width: number; height: number }
> = {
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
  // livekit-client treats 0 x 0 as uncapped: the screen's own size.
  native: { width: 0, height: 0 },
};

/** Copy presets by height. 540p sits between LiveKit's 360p and 720p screen presets. */
const COPY_PRESETS: Record<number, VideoPreset> = {
  360: ScreenSharePresets.h360fps15,
  540: new VideoPreset(960, 540, 900_000, 15, 'medium'),
  720: ScreenSharePresets.h720fps15,
  1080: ScreenSharePresets.h1080fps15,
};

/** A share counts as "above 1080p" from here, so a 1200p screen does not get a near-equal 1080p copy. */
const LARGE_SOURCE_MIN_HEIGHT = 1350;

/**
 * Heights of the smaller copies (#2742). Auto: a large share (e.g. 1440p) sends 1080p for most
 * viewers and 540p for weak connections; 1080p or smaller sends 720p and 360p. Copies that are
 * not clearly smaller than the shared picture are dropped, so a small window sends fewer.
 * `sourceHeight` is the short side of the captured picture; unknown keeps the list as is.
 */
export function screenShareCopyHeights(
  layers: ScreenShareLayers,
  sourceHeight?: number,
): number[] {
  const known = sourceHeight !== undefined && sourceHeight > 0;
  let heights: number[];
  if (layers === 'auto') {
    heights =
      known && sourceHeight >= LARGE_SOURCE_MIN_HEIGHT
        ? [540, 1080]
        : [360, 720];
  } else {
    heights = layers.split('+').map((part) => Number.parseInt(part, 10));
  }
  return known ? heights.filter((h) => h < sourceHeight * 0.9) : heights;
}

/** What the browser should capture: the max size is an upper bound, nothing is scaled up. */
export function buildScreenShareCaptureOptions(
  settings: ScreenSharePublishSettings,
): ScreenShareCaptureOptions {
  // The capture runs at 30 fps either way (livekit-client's default); the encoder sets the rate.
  return {
    contentHint: 'detail',
    resolution: { ...CAPTURE_SIZE[settings.maxSize], frameRate: 30 },
  };
}

/**
 * Publish options for a share of `source` size. `maintain-resolution` stays fixed: on a short
 * uplink frames drop, not pixels. VP9 and AV1 make their smaller copies inside one stream (SVC, at
 * 1/2 and 1/4 of the full size), so `layers` only applies to VP8 and H.264; LiveKit adds a VP8
 * copy for viewers whose browser cannot decode them.
 */
export function buildScreenSharePublishOptions(
  settings: ScreenSharePublishSettings,
  source?: { width: number; height: number },
): TrackPublishOptions {
  const sourceHeight = source
    ? Math.min(source.width, source.height)
    : undefined;
  const copies = screenShareCopyHeights(settings.layers, sourceHeight)
    .map((h) => COPY_PRESETS[h])
    .filter((preset): preset is VideoPreset => preset !== undefined);
  return {
    simulcast: true,
    videoCodec: settings.codec as VideoCodec,
    screenShareEncoding: {
      maxBitrate: Math.round(settings.bitrateMbps * 1_000_000),
      maxFramerate: settings.frameRate,
    },
    screenShareSimulcastLayers: copies,
    degradationPreference: 'maintain-resolution',
  };
}

/**
 * Starts a share in two steps so the copies can follow the picked surface: capture first (the
 * browser picker), then publish with copies chosen from the captured size. Same steps as
 * `setScreenShareEnabled(true)`, which picks the copies before it knows the size.
 */
type ScreenShareStart = {
  source?: { width: number; height: number };
  publish: TrackPublishOptions;
};

/** One start per room at a time, like LiveKit's own pending-publish guard (e.g. a double click). */
const startsInFlight = new WeakMap<Room, Promise<ScreenShareStart>>();

export function publishScreenShare(
  room: Room,
  settings: ScreenSharePublishSettings,
): Promise<ScreenShareStart> {
  const pending = startsInFlight.get(room);
  if (pending) return pending;
  const start = startScreenShare(room, settings).finally(() => {
    startsInFlight.delete(room);
  });
  startsInFlight.set(room, start);
  return start;
}

async function startScreenShare(
  room: Room,
  settings: ScreenSharePublishSettings,
): Promise<ScreenShareStart> {
  const tracks: LocalTrack[] = await room.localParticipant.createScreenTracks(
    buildScreenShareCaptureOptions(settings),
  );
  try {
    const video = tracks.find((t) => t.source === Track.Source.ScreenShare);
    const size = video?.mediaStreamTrack.getSettings();
    const source =
      size?.width && size?.height
        ? { width: size.width, height: size.height }
        : undefined;
    const publish = buildScreenSharePublishOptions(settings, source);
    await Promise.all(
      tracks.map((t) => room.localParticipant.publishTrack(t, publish)),
    );
    return { source, publish };
  } catch (e) {
    for (const t of tracks) t.stop();
    throw e;
  }
}

/** Keeps only known values, so an old or edited stored value falls back to the default. */
export function normalizeScreenSharePublishSettings(
  value: unknown,
): ScreenSharePublishSettings {
  const input =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const pick = <K extends keyof ScreenSharePublishSettings>(key: K) => {
    const choices = SCREEN_SHARE_SETTING_CHOICES[key] as ReadonlyArray<unknown>;
    return (
      choices.includes(input[key])
        ? input[key]
        : DEFAULT_SCREEN_SHARE_PUBLISH_SETTINGS[key]
    ) as ScreenSharePublishSettings[K];
  };
  return {
    maxSize: pick('maxSize'),
    frameRate: pick('frameRate'),
    bitrateMbps: pick('bitrateMbps'),
    layers: pick('layers'),
    codec: pick('codec'),
  };
}

// ---- Store (localStorage + subscribers) ----

const STORAGE_KEY = 'hypha.call.screenShareSettings';
const listeners = new Set<() => void>();
let cached: ScreenSharePublishSettings | null = null;

function readStored(): ScreenSharePublishSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeScreenSharePublishSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_SCREEN_SHARE_PUBLISH_SETTINGS;
  }
}

export function getScreenSharePublishSettings(): ScreenSharePublishSettings {
  if (typeof window === 'undefined')
    return DEFAULT_SCREEN_SHARE_PUBLISH_SETTINGS;
  if (!cached) cached = readStored();
  return cached;
}

export function setScreenSharePublishSettings(
  next: ScreenSharePublishSettings | null,
): void {
  cached = next
    ? normalizeScreenSharePublishSettings(next)
    : DEFAULT_SCREEN_SHARE_PUBLISH_SETTINGS;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this page.
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useScreenSharePublishSettings(): ScreenSharePublishSettings {
  return useSyncExternalStore(
    subscribe,
    getScreenSharePublishSettings,
    () => DEFAULT_SCREEN_SHARE_PUBLISH_SETTINGS,
  );
}
