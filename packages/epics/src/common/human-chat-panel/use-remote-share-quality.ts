'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import {
  resolveCallShareQualityPhase,
  type CallShareQualityPhase,
} from './call-share-quality-state';

export type RemoteShareQuality = {
  phase: CallShareQualityPhase;
  receivedWidth: number;
  receivedHeight: number;
};

const POLL_MS = 500;

const IDLE: RemoteShareQuality = {
  phase: 'done',
  receivedWidth: 0,
  receivedHeight: 0,
};

/**
 * Tracks how sharp a remote screenshare tile is compared to what its rendered size can show.
 * Re-arms (back to starting/improving) when the track changes or the tile is resized, because
 * LiveKit `adaptiveStream` then asks the server for a different layer.
 */
export function useRemoteShareQuality(options: {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  /** Changes when a new share track is bound. */
  trackKey: string | undefined;
  getPublishedWidth: () => number | undefined;
}): RemoteShareQuality {
  const { videoRef, enabled, trackKey } = options;
  const getPublishedWidthRef = useRef(options.getPublishedWidth);
  getPublishedWidthRef.current = options.getPublishedWidth;
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
      const result = resolveCallShareQualityPhase({
        receivedWidth: el.videoWidth,
        receivedHeight: el.videoHeight,
        renderedWidth: el.clientWidth,
        renderedHeight: el.clientHeight,
        devicePixelRatio: el.ownerDocument.defaultView?.devicePixelRatio ?? 1,
        publishedWidth: getPublishedWidthRef.current(),
        elapsedMs: Date.now() - startedAt,
      });
      setQuality((prev) =>
        prev.phase === result.phase &&
        prev.receivedWidth === el.videoWidth &&
        prev.receivedHeight === el.videoHeight
          ? prev
          : {
              phase: result.phase,
              receivedWidth: el.videoWidth,
              receivedHeight: el.videoHeight,
            },
      );
    };

    evaluate();
    const interval = window.setInterval(evaluate, POLL_MS);
    el.addEventListener('resize', evaluate);
    el.addEventListener('loadedmetadata', evaluate);
    return () => {
      window.clearInterval(interval);
      el.removeEventListener('resize', evaluate);
      el.removeEventListener('loadedmetadata', evaluate);
    };
  }, [videoRef, enabled, trackKey]);

  return quality;
}
