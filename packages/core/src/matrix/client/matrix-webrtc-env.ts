/**
 * Browser-visible WebRTC options for Matrix group calls (`createClient`).
 * Credentials stay on the homeserver (`/voip/turnServer`); these toggles help
 * deployments recover when TURN is disabled, missing, or relay-only paths are required.
 */

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === '') return fallback;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function parseNonNegativeInt(
  raw: string | undefined,
  fallback: number,
): number {
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/** Force relay (TURN) for all Matrix calls — default false. */
export function matrixWebRtcForceTurnFromEnv(): boolean {
  if (typeof process === 'undefined') return false;
  return parseBool(process.env['NEXT_PUBLIC_MATRIX_WEBRTC_FORCE_TURN'], false);
}

/**
 * Emit privacy-safe Matrix group-call diagnostics outside local development.
 * Enable only on preview/debug deployments.
 */
export function matrixWebRtcDebugFromEnv(): boolean {
  if (typeof process === 'undefined') return false;
  return parseBool(process.env['NEXT_PUBLIC_MATRIX_WEBRTC_DEBUG'], false);
}

/**
 * Allow public STUN fallback when the homeserver returns no ICE servers.
 * matrix-js-sdk default is false — set to true only if your deployment allows it.
 */
export function matrixWebRtcFallbackIceAllowedFromEnv(): boolean {
  if (typeof process === 'undefined') return false;
  return parseBool(
    process.env['NEXT_PUBLIC_MATRIX_WEBRTC_FALLBACK_ICE_ALLOWED'],
    false,
  );
}

/**
 * ICE candidate pre-gather pool for faster first connect; 0 keeps SDK default.
 */
export function matrixWebRtcIceCandidatePoolSizeFromEnv(): number {
  if (typeof process === 'undefined') return 0;
  return Math.min(
    parseNonNegativeInt(
      process.env['NEXT_PUBLIC_MATRIX_WEBRTC_ICE_POOL_SIZE'],
      0,
    ),
    255,
  );
}

/**
 * Matrix `GroupCall` periodic summary stats interval (ms). 0 disables.
 * Emits `hypha.group_call.webrtc_summary` when > 0.
 */
export function matrixGroupCallSummaryStatsMsFromEnv(): number {
  if (typeof process === 'undefined') return 0;
  return parseNonNegativeInt(
    process.env['NEXT_PUBLIC_MATRIX_WEBRTC_GROUP_STATS_MS'],
    0,
  );
}

/** Thumbnail receiver downscale when N ≥ 5 — default true (WCUX-QUALITY-4). */
export function callThumbnailDownscaleFromEnv(): boolean {
  if (typeof process === 'undefined') return true;
  return parseBool(process.env['NEXT_PUBLIC_CALL_THUMBNAIL_DOWNSCALE'], true);
}
