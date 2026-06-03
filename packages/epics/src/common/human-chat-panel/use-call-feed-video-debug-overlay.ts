'use client';

import { useEffect, useState, type RefObject } from 'react';
import { isMatrixCallSupportDebugEnabled } from '@hypha-platform/core/client';

export function useMatrixCallDebugOverlayEnabled(): boolean {
  const [enabled, setEnabled] = useState(() =>
    isMatrixCallSupportDebugEnabled(),
  );

  useEffect(() => {
    setEnabled(isMatrixCallSupportDebugEnabled());
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === 'hypha.callDebug' ||
        event.key === 'hypha.group_call.debug' ||
        event.key === null
      ) {
        setEnabled(isMatrixCallSupportDebugEnabled());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return enabled;
}

export function useCallFeedVideoDebugDimensions(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): string | null {
  const [dimensions, setDimensions] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setDimensions(null);
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    const update = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setDimensions(`${video.videoWidth}×${video.videoHeight}`);
      }
    };

    update();
    video.addEventListener('loadedmetadata', update);
    video.addEventListener('resize', update);
    video.addEventListener('loadeddata', update);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    resizeObserver?.observe(video);

    return () => {
      video.removeEventListener('loadedmetadata', update);
      video.removeEventListener('resize', update);
      video.removeEventListener('loadeddata', update);
      resizeObserver?.disconnect();
    };
  }, [enabled, videoRef]);

  return dimensions;
}
