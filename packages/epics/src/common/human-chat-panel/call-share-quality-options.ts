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
      /** The tile is too small for this layer to be served; enlarge it first. */
      needsResize: boolean;
      /** The tile is big enough but this size is not arriving: the network is the limit. */
      limitedByNetwork?: boolean;
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

/** Width the server is asked for by `adaptiveStream`: CSS pixels times that density. */
export function adaptiveRequestWidthPx(
  contentWidthCssPx: number,
  devicePixelRatio: number,
): number {
  return contentWidthCssPx * adaptiveRequestDensity(devicePixelRatio);
}

/**
 * Options for the picker: Auto first, then published layers from the largest down. A layer needs a
 * bigger tile when the next smaller layer already covers the tile (the server serves the smallest
 * layer that covers the request; not stated in the LiveKit docs, to confirm on a real share).
 */
export function buildCallShareQualityOptions(input: {
  layers: ReadonlyArray<PublishedShareLayer>;
  /** See `adaptiveRequestWidthPx`; 0 or unknown disables nothing. */
  tileRequestWidth: number;
  /**
   * Width actually received when the tile gave up waiting for a sharper picture
   * (`limitedByNetwork`); larger layers that the tile could use are marked as network-limited.
   */
  networkLimitedAtWidth?: number;
}): CallShareQualityOption[] {
  const sorted = normalizePublishedLayers(input.layers);
  const options: CallShareQualityOption[] = [
    { id: CALL_SHARE_QUALITY_AUTO, kind: 'auto' },
  ];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const layer = sorted[i];
    if (!layer) continue;
    const smaller = i > 0 ? sorted[i - 1] : undefined;
    const needsResize =
      input.tileRequestWidth > 0 &&
      smaller !== undefined &&
      input.tileRequestWidth <= smaller.width;
    const limitedByNetwork =
      !needsResize &&
      input.networkLimitedAtWidth !== undefined &&
      input.networkLimitedAtWidth > 0 &&
      layer.width > input.networkLimitedAtWidth;
    options.push({
      id: layerOptionId(layer),
      kind: 'layer',
      width: layer.width,
      height: layer.height,
      label: `${Math.round(layer.height)}p`,
      needsResize,
      ...(limitedByNetwork ? { limitedByNetwork: true } : {}),
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
