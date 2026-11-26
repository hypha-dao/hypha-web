'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import {
  adaptiveRequestDensity,
  adaptiveRequestWidthPx,
  normalizePublishedLayers,
  type PublishedShareLayer,
} from './call-share-quality-options';
import {
  resolveCallShareQualityPhase,
  resolveRenderedContentWidthPx,
  type CallShareQualityPhase,
} from './call-share-quality-state';

export type RemoteShareQuality = {
  phase: CallShareQualityPhase;
  receivedWidth: number;
  receivedHeight: number;
  /** Gave up waiting while still below the target (network or sender limit). */
  limitedByNetwork: boolean;
  /** Width `adaptiveStream` asks the server for, from the current tile size. */
  tileRequestWidth: number;
  /** Layers the sender publishes, smallest first. */
  layers: PublishedShareLayer[];
};

const POLL_MS = 500;

const IDLE: RemoteShareQuality = {
  phase: 'done',
  receivedWidth: 0,
  receivedHeight: 0,
  limitedByNetwork: false,
  tileRequestWidth: 0,
  layers: [],
};

function sameLayers(a: PublishedShareLayer[], b: PublishedShareLayer[]) {
  return (
    a.length === b.length &&
    a.every((l, i) => l.width === b[i]?.width && l.height === b[i]?.height)
  );
}

/**
 * Tracks how sharp a remote screenshare tile is compared to what its rendered size can show.
 * Re-arms (back to starting/improving) when the track changes or the tile is resized, because
 * LiveKit `adaptiveStream` then asks the server for a different layer. A viewer cap (#2742)
 * lowers the target and re-arms too.
 */
export function useRemoteShareQuality(options: {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  /** Changes when a new share track is bound. */
  trackKey: string | undefined;
  getPublishedWidth: () => number | undefined;
  /** Layers the sender publishes (`TrackPublication.trackInfo.layers`). */
  getPublishedLayers?: () => ReadonlyArray<Partial<PublishedShareLayer>>;
  /** Width in pixels the viewer capped the share at; undefined = Auto. */
  capWidth?: number;
}): RemoteShareQuality {
  const { videoRef, enabled, trackKey, capWidth } = options;
  const getPublishedWidthRef = useRef(options.getPublishedWidth);
  getPublishedWidthRef.current = options.getPublishedWidth;
  const getPublishedLayersRef = useRef(options.getPublishedLayers);
  getPublishedLayersRef.current = options.getPublishedLayers;
  const [quality, setQuality] = useState<RemoteShareQuality>(IDLE);

  useEffect(() => {
    const el = videoRef.current;
    if (!enabled || !el) {
      setQuality(IDLE);
      return;
    }

    let startedAt = Date.now();
    let lastBox = `${el.clientWidth}x${el.clientHeight}`;

    const evaluate = () => {
      const box = `${el.clientWidth}x${el.clientHeight}`;
      if (box !== lastBox) {
        lastBox = box;
        startedAt = Date.now();
      }
      const devicePixelRatio =
        el.ownerDocument.defaultView?.devicePixelRatio ?? 1;
      const result = resolveCallShareQualityPhase({
        receivedWidth: el.videoWidth,
        receivedHeight: el.videoHeight,
        renderedWidth: el.clientWidth,
        renderedHeight: el.clientHeight,
        // Same density adaptiveStream requests at, so a share that arrives at the requested width
        // counts as done and is never marked "limited by network".
        devicePixelRatio: adaptiveRequestDensity(devicePixelRatio),
        publishedWidth: getPublishedWidthRef.current(),
        elapsedMs: Date.now() - startedAt,
        capWidth,
      });
      const contentCssWidth =
        resolveRenderedContentWidthPx({
          renderedWidth: el.clientWidth,
          renderedHeight: el.clientHeight,
          receivedWidth: el.videoWidth,
          receivedHeight: el.videoHeight,
          devicePixelRatio: 1,
        }) || 0;
      const tileRequestWidth = adaptiveRequestWidthPx(
        contentCssWidth,
        devicePixelRatio,
      );
      const layers = normalizePublishedLayers(
        getPublishedLayersRef.current?.(),
      );
      const limitedByNetwork = Boolean(result.limitedByNetwork);
      setQuality((prev) =>
        prev.phase === result.phase &&
        prev.receivedWidth === el.videoWidth &&
        prev.receivedHeight === el.videoHeight &&
        prev.limitedByNetwork === limitedByNetwork &&
        prev.tileRequestWidth === tileRequestWidth &&
        sameLayers(prev.layers, layers)
          ? prev
          : {
              phase: result.phase,
              receivedWidth: el.videoWidth,
              receivedHeight: el.videoHeight,
              limitedByNetwork,
              tileRequestWidth,
              layers,
            },
      );
    };

    // A new cap restarts the wait, so the badge shows "improving" while the layer switches.
    startedAt = Date.now();
    evaluate();
    const interval = window.setInterval(evaluate, POLL_MS);
    el.addEventListener('resize', evaluate);
    el.addEventListener('loadedmetadata', evaluate);
    return () => {
      window.clearInterval(interval);
      el.removeEventListener('resize', evaluate);
      el.removeEventListener('loadedmetadata', evaluate);
    };
  }, [videoRef, enabled, trackKey, capWidth]);

  return quality;
}
