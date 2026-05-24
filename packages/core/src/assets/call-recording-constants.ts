/** In-call browser capture is sized for calls up to 90 minutes. */
export const CALL_RECORDING_TARGET_DURATION_SECONDS = 90 * 60;

/** Canvas compositor output for in-call browser capture (must match call-recording.ts). */
export const CALL_RECORDING_COMPOSITOR_WIDTH = 854;
export const CALL_RECORDING_COMPOSITOR_HEIGHT = 480;
export const CALL_RECORDING_COMPOSITOR_FPS = 24;

/** Default MediaRecorder bitrates (must match call-recording.ts). */
export const CALL_RECORDING_AUDIO_BITS_PER_SECOND = 128_000;
/** 854×480 @ 24fps; ~850 kbps balances clarity with the 640 MB upload cap for 90 min. */
export const CALL_RECORDING_VIDEO_BITS_PER_SECOND = 850_000;

/** Warn when elapsed capture reaches this fraction of the target duration. */
export const CALL_RECORDING_DURATION_WARN_RATIO = 0.8;
export const CALL_RECORDING_DURATION_CRITICAL_RATIO = 0.9;

/** Warn when estimated size reaches this fraction of the upload cap. */
export const CALL_RECORDING_SIZE_WARN_RATIO = 0.8;
export const CALL_RECORDING_SIZE_CRITICAL_RATIO = 0.9;

/**
 * Upload cap for call recordings. At default recorder bitrates (128k audio + 850k
 * video) a 90-minute capture is ~660 MB; 640 MB leaves headroom for encoder variance.
 */
export const CALL_RECORDING_MAX_FILE_SIZE_BYTES = 640 * 1024 * 1024;

/** Shown in capture warnings and upload error copy. */
export const CALL_RECORDING_MAX_FILE_SIZE_LABEL = '640MB' as const;

/** UploadThing only accepts fixed size tiers; keep >= CALL_RECORDING_MAX_FILE_SIZE_BYTES. */
export const CALL_RECORDING_UPLOADTHING_MAX_FILE_SIZE = '1024MB' as const;

export const CALL_RECORDING_MIN_FILE_SIZE_BYTES = 2048;

/** Hostnames allowed for ingested call recording media_uri (UploadThing CDN). */
export const CALL_RECORDING_TRUSTED_STORAGE_HOST_SUFFIXES = [
  '.utfs.io',
  '.ufs.sh',
] as const;

export function isTrustedCallRecordingMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return CALL_RECORDING_TRUSTED_STORAGE_HOST_SUFFIXES.some(
      (suffix) => host === suffix.slice(1) || host.endsWith(suffix),
    );
  } catch {
    return false;
  }
}

export function objectStorageUriMatchesKey(
  url: string,
  storageKey: string,
): boolean {
  const key = storageKey.trim();
  if (!key) return false;
  try {
    const parsed = new URL(url.trim());
    const path = decodeURIComponent(parsed.pathname);
    const segments = path.split('/').filter(Boolean);
    return segments.includes(key) || segments.at(-1) === key;
  } catch {
    return false;
  }
}

export function computeCallRecordingDurationSeconds(
  startedAt?: string,
  endedAt?: string,
): number | null {
  const startMs = startedAt ? Date.parse(startedAt) : Number.NaN;
  const endMs = endedAt ? Date.parse(endedAt) : Number.NaN;
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs
  ) {
    return null;
  }
  return Math.round((endMs - startMs) / 1000);
}
