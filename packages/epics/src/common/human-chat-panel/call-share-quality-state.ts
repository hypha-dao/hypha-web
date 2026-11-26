/**
 * Remote screenshare quality phase (#2427).
 *
 * LiveKit `adaptiveStream` starts a share on the low simulcast layer and switches to a higher one
 * once it knows the rendered size, so the viewer first sees a blurry picture. This module decides
 * whether the received picture is already as sharp as the tile can show it.
 */

export type CallShareQualityPhase = 'starting' | 'improving' | 'done';

/** After this long we stop showing the "improving" state (network-limited or no higher layer). */
export const CALL_SHARE_QUALITY_IMPROVING_TIMEOUT_MS = 10_000;

/** Received width must reach this share of the target to count as sharp. */
const SHARP_ENOUGH_RATIO = 0.98;

export type CallShareQualityInput = {
  /** `video.videoWidth` / `videoHeight` — resolution actually decoded (0 before the first frame). */
  receivedWidth: number;
  receivedHeight: number;
  /** Rendered element box in CSS pixels (`clientWidth` / `clientHeight`). */
  renderedWidth: number;
  renderedHeight: number;
  devicePixelRatio: number;
  /** Highest resolution the sender publishes (`TrackPublication.dimensions`), when known. */
  publishedWidth?: number;
  /** Time since the tile started showing this share (or was last resized). */
  elapsedMs: number;
  /** Viewer's manual cap in pixels of width (#2742); lowers the target, never raises it. */
  capWidth?: number;
};

export type CallShareQualityResult = {
  phase: CallShareQualityPhase;
  /** Width in device pixels the tile could show; undefined when it cannot be derived. */
  targetWidth?: number;
  /** Gave up waiting while still below the target: the network or the sender is the limit. */
  limitedByNetwork?: boolean;
};

/**
 * Width in device pixels the video content occupies inside its box. With `object-fit: contain` a
 * wide box around a narrow picture is limited by height, so width alone would overstate the target.
 */
export function resolveRenderedContentWidthPx(input: {
  renderedWidth: number;
  renderedHeight: number;
  receivedWidth: number;
  receivedHeight: number;
  devicePixelRatio: number;
}): number {
  const { renderedWidth, renderedHeight, receivedWidth, receivedHeight } =
    input;
  const dpr = input.devicePixelRatio > 0 ? input.devicePixelRatio : 1;
  if (renderedWidth <= 0 || renderedHeight <= 0) return 0;
  let contentWidth = renderedWidth;
  if (receivedWidth > 0 && receivedHeight > 0) {
    contentWidth = Math.min(
      renderedWidth,
      renderedHeight * (receivedWidth / receivedHeight),
    );
  }
  return contentWidth * dpr;
}

export function resolveCallShareQualityPhase(
  input: CallShareQualityInput,
): CallShareQualityResult {
  const timedOut = input.elapsedMs >= CALL_SHARE_QUALITY_IMPROVING_TIMEOUT_MS;

  if (input.receivedWidth <= 0) {
    return { phase: timedOut ? 'done' : 'starting' };
  }

  const renderedTarget = resolveRenderedContentWidthPx(input);
  if (renderedTarget <= 0) {
    return { phase: 'done' };
  }
  let targetWidth =
    input.publishedWidth && input.publishedWidth > 0
      ? Math.min(input.publishedWidth, renderedTarget)
      : renderedTarget;
  if (input.capWidth && input.capWidth > 0) {
    targetWidth = Math.min(targetWidth, input.capWidth);
  }

  if (input.receivedWidth >= targetWidth * SHARP_ENOUGH_RATIO) {
    return { phase: 'done', targetWidth };
  }
  if (timedOut) {
    return { phase: 'done', targetWidth, limitedByNetwork: true };
  }
  return { phase: 'improving', targetWidth };
}

/** "1920×1080" style label for the badge. */
export function formatCallShareResolution(
  width: number,
  height: number,
): string | null {
  if (!(width > 0) || !(height > 0)) return null;
  return `${Math.round(width)}×${Math.round(height)}`;
}
