import { SCREENSHARE_FILMSTRIP } from './call-screenshare-filmstrip-geometry';

/** Default Document PiP size when not in screenshare filmstrip mode. */
/** Document PiP auto-open is disabled while we stabilize share UX — re-enable later. */
export const CALL_DOCUMENT_PIP_ENABLED = false;

export const CALL_DOCUMENT_PIP_CALL = {
  width: 480,
  height: 320,
  minWidth: 480,
  minHeight: 320,
  maxWidth: 880,
  maxHeight: 640,
  /** Match floating dock thumbnail geometry (480×320). */
  aspectRatio: 480 / 320,
} as const;

/** Narrow vertical Document PiP while presenting — wide enough for 4 control buttons. */
export const CALL_DOCUMENT_PIP_FILMSTRIP_WIDTH = 224;

/** Filmstrip PiP window bounds (height follows participant count). */
export const CALL_DOCUMENT_PIP_FILMSTRIP = {
  width: CALL_DOCUMENT_PIP_FILMSTRIP_WIDTH,
  minWidth: CALL_DOCUMENT_PIP_FILMSTRIP_WIDTH,
  maxWidth: 240,
  minHeight: SCREENSHARE_FILMSTRIP.minDockHeight,
} as const;

export type CallDocumentPipWindowMode = 'filmstrip' | 'call';

export type CallDocumentPipWindowSize = {
  width: number;
  height: number;
};

export function resolveCallDocumentPipViewportMaxHeight(
  viewportMaxHeight?: number,
): number {
  if (viewportMaxHeight != null) {
    return Math.max(CALL_DOCUMENT_PIP_CALL.minHeight, viewportMaxHeight);
  }
  if (typeof window !== 'undefined') {
    return Math.max(
      CALL_DOCUMENT_PIP_CALL.minHeight,
      window.screen.availHeight - 32,
    );
  }
  return CALL_DOCUMENT_PIP_CALL.maxHeight;
}

/** Clamp PiP outer window size so content never collapses into an unusable strip. */
export function clampCallDocumentPipWindowSize(
  size: CallDocumentPipWindowSize,
  mode: CallDocumentPipWindowMode,
  viewportMaxHeight?: number,
): CallDocumentPipWindowSize {
  const maxHeight = resolveCallDocumentPipViewportMaxHeight(viewportMaxHeight);

  if (mode === 'filmstrip') {
    const width = Math.min(
      CALL_DOCUMENT_PIP_FILMSTRIP.maxWidth,
      Math.max(CALL_DOCUMENT_PIP_FILMSTRIP.minWidth, Math.round(size.width)),
    );
    const height = Math.min(
      maxHeight,
      Math.max(CALL_DOCUMENT_PIP_FILMSTRIP.minHeight, Math.round(size.height)),
    );
    return { width, height };
  }

  const ratio = CALL_DOCUMENT_PIP_CALL.aspectRatio;
  const maxWidth = CALL_DOCUMENT_PIP_CALL.maxWidth;
  const maxHeightCap = Math.min(maxHeight, CALL_DOCUMENT_PIP_CALL.maxHeight);
  const minWidth = CALL_DOCUMENT_PIP_CALL.minWidth;
  const minHeight = CALL_DOCUMENT_PIP_CALL.minHeight;

  let width = Math.max(minWidth, Math.round(size.width));
  let height = Math.max(minHeight, Math.round(size.height));

  if (width / height < ratio) {
    width = Math.ceil(height * ratio);
  } else if (width / height > ratio) {
    height = Math.ceil(width / ratio);
  }

  if (width > maxWidth || height > maxHeightCap) {
    const scale = Math.min(maxWidth / width, maxHeightCap / height);
    width = Math.max(minWidth, Math.floor(width * scale));
    height = Math.max(minHeight, Math.floor(height * scale));
  }

  if (width / height < ratio) {
    width = Math.min(maxWidth, Math.ceil(height * ratio));
  } else if (width / height > ratio) {
    height = Math.min(maxHeightCap, Math.ceil(width / ratio));
  }

  width = Math.max(minWidth, Math.min(maxWidth, width));
  height = Math.max(minHeight, Math.min(maxHeightCap, height));

  return { width, height };
}
