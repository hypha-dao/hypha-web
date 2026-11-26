/**
 * Sharer-side screenshare mode (#2742). Detail is today's share (full resolution, 15 fps, sharp
 * text). Smooth keeps the same resolution and lets the top layer run at up to 30 fps with a larger
 * bitrate, for video and motion. Both keep `degradationPreference: 'maintain-resolution'`, so when
 * the uplink is short the browser drops frames, not pixels.
 *
 * Switched live on the running share via `RTCRtpSender.setParameters` (no republish, no new screen
 * picker). The capture already runs at 30 fps (livekit-client asks `getDisplayMedia` for
 * `h1080fps30`); only the top encoding's cap changes.
 */

export type CallShareSendMode = 'detail' | 'smooth';

export const CALL_SHARE_SEND_MODE_DEFAULT: CallShareSendMode = 'detail';

/** Smooth top layer: the `ScreenSharePresets.h1080fps30` frame rate and bitrate. */
export const CALL_SHARE_SMOOTH_MAX_FRAMERATE = 30;
export const CALL_SHARE_SMOOTH_MAX_BITRATE = 5_000_000;

export type ShareTopEncoding = {
  maxFramerate?: number;
  maxBitrate?: number;
};

/**
 * Index of the full-resolution encoding: the smallest `scaleResolutionDownBy` (unset = 1); on a tie
 * the last one, since livekit-client orders simulcast encodings from low to high.
 */
export function topEncodingIndex(
  encodings: ReadonlyArray<{ scaleResolutionDownBy?: number }>,
): number {
  let best = -1;
  let bestScale = Number.POSITIVE_INFINITY;
  encodings.forEach((encoding, index) => {
    const scale = encoding.scaleResolutionDownBy ?? 1;
    if (scale <= bestScale) {
      best = index;
      bestScale = scale;
    }
  });
  return best;
}

/**
 * Encodings for `mode`. Only the top layer changes; Detail restores the values it had at publish
 * time (`detailTop`), so it stays exactly today's share. Returns a new array.
 */
export function shareEncodingsForMode<
  T extends RTCRtpEncodingParameters & { maxFramerate?: number },
>(
  encodings: ReadonlyArray<T>,
  mode: CallShareSendMode,
  detailTop: ShareTopEncoding,
): T[] {
  const next = encodings.map((encoding) => ({ ...encoding }));
  const index = topEncodingIndex(next);
  const top = next[index];
  if (!top) return next;
  const target: ShareTopEncoding =
    mode === 'smooth'
      ? {
          maxFramerate: CALL_SHARE_SMOOTH_MAX_FRAMERATE,
          maxBitrate: Math.max(
            CALL_SHARE_SMOOTH_MAX_BITRATE,
            detailTop.maxBitrate ?? 0,
          ),
        }
      : detailTop;
  if (target.maxFramerate === undefined) delete top.maxFramerate;
  else top.maxFramerate = target.maxFramerate;
  if (target.maxBitrate === undefined) delete top.maxBitrate;
  else top.maxBitrate = target.maxBitrate;
  return next;
}

/** Which mode the sender's current top layer matches; undefined if neither. */
export function shareModeFromEncodings(
  encodings: ReadonlyArray<
    RTCRtpEncodingParameters & { maxFramerate?: number }
  >,
  detailTop: ShareTopEncoding,
): CallShareSendMode | undefined {
  const top = encodings[topEncodingIndex(encodings)];
  if (!top) return undefined;
  for (const mode of ['detail', 'smooth'] as const) {
    const [expected] = shareEncodingsForMode([top], mode, detailTop);
    if (
      expected &&
      expected.maxFramerate === top.maxFramerate &&
      expected.maxBitrate === top.maxBitrate
    ) {
      return mode;
    }
  }
  return undefined;
}
