/** In-call browser capture is sized for calls up to 90 minutes. */
export const CALL_RECORDING_TARGET_DURATION_SECONDS = 90 * 60;

/** Default MediaRecorder bitrates (must match call-recording.ts). */
export const CALL_RECORDING_AUDIO_BITS_PER_SECOND = 48_000;
export const CALL_RECORDING_VIDEO_BITS_PER_SECOND = 96_000;

/** Warn when elapsed capture reaches this fraction of the target duration. */
export const CALL_RECORDING_DURATION_WARN_RATIO = 0.8;
export const CALL_RECORDING_DURATION_CRITICAL_RATIO = 0.9;

/** Warn when estimated size reaches this fraction of the upload cap. */
export const CALL_RECORDING_SIZE_WARN_RATIO = 0.8;
export const CALL_RECORDING_SIZE_CRITICAL_RATIO = 0.9;

/**
 * Upload cap for call recordings. At default recorder bitrates (48k audio + 96k
 * video) a 90-minute capture is ~97 MB; 512 MB leaves headroom for encoder variance.
 */
export const CALL_RECORDING_MAX_FILE_SIZE_BYTES = 512 * 1024 * 1024;

export const CALL_RECORDING_UPLOADTHING_MAX_FILE_SIZE = '512MB' as const;

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
    return path.includes(key) || parsed.href.includes(key);
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
