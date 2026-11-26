/**
 * Receive-quality picker options for a remote screenshare (#2742).
 *
 * LiveKit's `adaptiveStream` always keeps the rendered tile size as a ceiling, so a manual choice
 * can only *cap* quality below what the tile justifies; it cannot force a bigger layer. The picker
 * therefore lists the layers the sharer actually publishes, and marks the ones the current tile is
 * too small to use ("resize") instead of pretending they would apply.
 */

export const CALL_SHARE_QUALITY_AUTO = 'auto';

export type PublishedShareLayer = { width: number; height: number };

export type CallShareQualityOption =
  | { id: typeof CALL_SHARE_QUALITY_AUTO; kind: 'auto' }
  | {
      id: string;
      kind: 'layer';
      width: number;
      height: number;
      /** e.g. "1080p" */
      label: string;
      /** The tile is too small for this layer to be served (or the network holds it back). */
      needsResize: boolean;
    };

export function layerOptionId(layer: PublishedShareLayer): string {
  return `layer:${Math.round(layer.width)}x${Math.round(layer.height)}`;
}

/** Drops invalid or duplicate layers and sorts from smallest to largest. */
export function normalizePublishedLayers(
  layers: ReadonlyArray<Partial<PublishedShareLayer> | undefined> | undefined,
): PublishedShareLayer[] {
  const seen = new Set<string>();
  const out: PublishedShareLayer[] = [];
  for (const l of layers ?? []) {
    const width = l?.width ?? 0;
    const height = l?.height ?? 0;
    if (!(width > 0) || !(height > 0)) continue;
    const key = `${Math.round(width)}x${Math.round(height)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ width, height });
  }
  return out.sort((a, b) => a.width - b.width);
}

/**
 * Pixel density `adaptiveStream` requests at: the screen's real density, since the room sets
 * `pixelDensity: 'screen'` (`createLiveKitRoom` in core).
 */
export function adaptiveRequestDensity(devicePixelRatio: number): number {
  return devicePixelRatio > 0 ? devicePixelRatio : 1;
}

export type ShareTileRequest = { width: number; height: number };

/**
 * Size `adaptiveStream` asks the server for: the whole video box (letterbox included) times that
 * density, as livekit-client's `updateDimensions` does.
 */
export function adaptiveRequestSize(
  boxWidthCssPx: number,
  boxHeightCssPx: number,
  devicePixelRatio: number,
): ShareTileRequest {
  const density = adaptiveRequestDensity(devicePixelRatio);
  return { width: boxWidthCssPx * density, height: boxHeightCssPx * density };
}

/** livekit-server's `layerSelectionTolerance`: a copy counts from 90% of the requested size. */
const LAYER_SELECTION_TOLERANCE = 0.9;

/**
 * livekit-server's rule (`GetQualityForDimension`, checked on v1.13.3, the deployed version): with
 * published copies it compares heights only, even for a portrait share, against the requested
 * height times the tolerance.
 */
function covers(layer: PublishedShareLayer, request: ShareTileRequest) {
  return layer.height >= request.height * LAYER_SELECTION_TOLERANCE;
}

/**
 * The copy the server sends for `request`: the smallest that covers it, else the largest. Seen on
 * a preview: a 1275 x 815 box got 1080p (815 x 0.9 is above 720).
 */
export function servedShareLayer(
  layers: ReadonlyArray<PublishedShareLayer>,
  request: ShareTileRequest,
): PublishedShareLayer | undefined {
  const sorted = normalizePublishedLayers(layers);
  return sorted.find((l) => covers(l, request)) ?? sorted[sorted.length - 1];
}

/** A received picture this close to a copy's listed size is that copy (a shared window may shrink). */
const SAME_LAYER_RATIO = 0.9;

/**
 * Options for the picker: Auto first, then published layers from the largest down. A layer is
 * unavailable when the next smaller one already covers the tile, unless it is the one arriving.
 */
export function buildCallShareQualityOptions(input: {
  layers: ReadonlyArray<PublishedShareLayer>;
  /** See `adaptiveRequestSize`; unknown or 0 disables nothing. */
  tileRequest?: ShareTileRequest;
  /** Height of the picture arriving now (`video.videoHeight`). */
  receivedHeight?: number;
}): CallShareQualityOption[] {
  const sorted = normalizePublishedLayers(input.layers);
  const request = input.tileRequest;
  const requestKnown = Boolean(
    request && request.width > 0 && request.height > 0,
  );
  const options: CallShareQualityOption[] = [
    { id: CALL_SHARE_QUALITY_AUTO, kind: 'auto' },
  ];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const layer = sorted[i];
    if (!layer) continue;
    const smaller = i > 0 ? sorted[i - 1] : undefined;
    const arriving =
      (input.receivedHeight ?? 0) >= layer.height * SAME_LAYER_RATIO;
    const needsResize =
      requestKnown &&
      request !== undefined &&
      smaller !== undefined &&
      covers(smaller, request) &&
      !arriving;
    options.push({
      id: layerOptionId(layer),
      kind: 'layer',
      width: layer.width,
      height: layer.height,
      label: `${Math.round(layer.height)}p`,
      needsResize,
    });
  }
  return options;
}

export function findCallShareQualityOption(
  options: ReadonlyArray<CallShareQualityOption>,
  id: string,
): CallShareQualityOption | undefined {
  return options.find((o) => o.id === id);
}

export type CallShareQualityReason =
  | 'improving'
  | 'auto'
  | 'capped'
  | 'limited-by-network';

/** Short reason shown next to the resolution badge. */
export function resolveCallShareQualityReason(input: {
  phase: 'starting' | 'improving' | 'done';
  manual: boolean;
  limitedByNetwork: boolean;
}): CallShareQualityReason {
  if (input.phase !== 'done') return 'improving';
  if (input.limitedByNetwork) return 'limited-by-network';
  return input.manual ? 'capped' : 'auto';
}
