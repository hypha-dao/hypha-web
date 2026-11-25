'use client';

import { useCallback, useEffect, useState } from 'react';
import { VideoQuality, type RemoteTrackPublication } from 'livekit-client';

import {
  CALL_SHARE_QUALITY_AUTO,
  type CallShareQualityOption,
  type PublishedShareLayer,
} from './call-share-quality-options';

/**
 * Viewer's choice per share, keyed by publication sid so it survives the tile being remounted
 * (dock <-> stage) while the share lasts. A new share has a new sid, so the choice resets then.
 */
const choiceBySid = new Map<string, PublishedShareLayer>();

/** Applies the cap to the publication: a layer's dimensions, or HIGH (= LiveKit's own default). */
export function applyShareQualityChoice(
  publication: RemoteTrackPublication,
  layer: PublishedShareLayer | undefined,
): void {
  if (layer) {
    publication.setVideoDimensions({
      width: layer.width,
      height: layer.height,
    });
  } else {
    // `setVideoQuality(HIGH)` clears any dimension cap; with adaptiveStream this is Auto.
    publication.setVideoQuality(VideoQuality.HIGH);
  }
}

export type RemoteShareQualityChoice = {
  selectedId: string;
  /** Manual cap in effect, if any. */
  selectedLayer: PublishedShareLayer | undefined;
  select: (option: CallShareQualityOption) => void;
};

/**
 * Receive-quality choice for one remote screenshare (#2742). Auto is the default and never calls
 * LiveKit, so users who never open the picker see no behaviour change.
 */
export function useRemoteShareQualityChoice(options: {
  getPublication: () => RemoteTrackPublication | undefined;
  /** Publication sid; changes when a new share starts. */
  shareKey: string | undefined;
}): RemoteShareQualityChoice {
  const { shareKey } = options;
  const [selectedLayer, setSelectedLayer] = useState<
    PublishedShareLayer | undefined
  >(() => (shareKey ? choiceBySid.get(shareKey) : undefined));
  const [selectedId, setSelectedId] = useState<string>(CALL_SHARE_QUALITY_AUTO);

  // Re-sync when the share changes; re-apply a remembered cap after a remount.
  useEffect(() => {
    const stored = shareKey ? choiceBySid.get(shareKey) : undefined;
    setSelectedLayer(stored);
    setSelectedId(
      stored
        ? `layer:${Math.round(stored.width)}x${Math.round(stored.height)}`
        : CALL_SHARE_QUALITY_AUTO,
    );
    const publication = options.getPublication();
    if (stored && publication) applyShareQualityChoice(publication, stored);
  }, [shareKey]);

  const getPublication = options.getPublication;
  const select = useCallback(
    (option: CallShareQualityOption) => {
      const publication = getPublication();
      const layer =
        option.kind === 'layer'
          ? { width: option.width, height: option.height }
          : undefined;
      if (shareKey) {
        if (layer) choiceBySid.set(shareKey, layer);
        else choiceBySid.delete(shareKey);
      }
      setSelectedLayer(layer);
      setSelectedId(option.id);
      if (publication) applyShareQualityChoice(publication, layer);
    },
    [getPublication, shareKey],
  );

  return { selectedId, selectedLayer, select };
}
