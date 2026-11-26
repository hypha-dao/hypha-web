'use client';

import { useSyncExternalStore } from 'react';
import {
  ScreenSharePresets,
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
export type ScreenShareLayers = '360p' | '360p+720p';
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
  layers: ['360p', '360p+720p'],
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
    layers: '360p+720p',
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

/**
 * Capture and publish options for a share. Smaller screens and windows keep their own size (the
 * size is an upper bound, nothing is scaled up). `maintain-resolution` and `contentHint: 'detail'`
 * stay fixed: on a short uplink frames drop, not pixels. VP9 and AV1 make the smaller copies inside
 * one stream (SVC), so `layers` only applies to VP8 and H.264; LiveKit adds a VP8 copy for viewers
 * whose browser cannot decode them.
 */
export function buildScreenShareOptions(settings: ScreenSharePublishSettings): {
  capture: ScreenShareCaptureOptions;
  publish: TrackPublishOptions;
} {
  // The capture runs at 30 fps either way (livekit-client's default); the encoder sets the rate.
  const capture: ScreenShareCaptureOptions = {
    contentHint: 'detail',
    resolution: { ...CAPTURE_SIZE[settings.maxSize], frameRate: 30 },
  };
  const publish: TrackPublishOptions = {
    simulcast: true,
    videoCodec: settings.codec as VideoCodec,
    screenShareEncoding: {
      maxBitrate: Math.round(settings.bitrateMbps * 1_000_000),
      maxFramerate: settings.frameRate,
    },
    screenShareSimulcastLayers:
      settings.layers === '360p+720p'
        ? [ScreenSharePresets.h360fps15, ScreenSharePresets.h720fps15]
        : [ScreenSharePresets.h360fps15],
    degradationPreference: 'maintain-resolution',
  };
  return { capture, publish };
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
