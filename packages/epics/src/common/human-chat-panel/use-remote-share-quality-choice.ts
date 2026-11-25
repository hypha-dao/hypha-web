'use client';

import { useCallback, useEffect, useRef } from 'react';
import { VideoQuality, type RemoteTrackPublication } from 'livekit-client';

import {
  CALL_SHARE_QUALITY_AUTO,
  layerOptionId,
  type CallShareQualityOption,
  type PublishedShareLayer,
} from './call-share-quality-options';
import {
  getShareQualityChoice,
  publishShareQualityPicker,
  setShareQualityChoice,
  useShareQualityChoiceVersion,
} from './call-share-quality-store';

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
 * Receive-quality choice for one remote screenshare (#2742), kept per publication sid so it
 * survives tile remounts (dock <-> stage <-> PiP) and resets with a new share. Auto is the default
 * and never calls LiveKit, so users who never open the picker see no behaviour change.
 */
export function useRemoteShareQualityChoice(options: {
  getPublication: () => RemoteTrackPublication | undefined;
  /** Publication sid; changes when a new share starts. */
  shareKey: string | undefined;
}): RemoteShareQualityChoice {
  const { shareKey, getPublication } = options;
  useShareQualityChoiceVersion();
  const selectedLayer = getShareQualityChoice(shareKey);
  const selectedId = selectedLayer
    ? layerOptionId(selectedLayer)
    : CALL_SHARE_QUALITY_AUTO;

  const select = useCallback(
    (option: CallShareQualityOption) => {
      const layer =
        option.kind === 'layer'
          ? { width: option.width, height: option.height }
          : undefined;
      if (shareKey) setShareQualityChoice(shareKey, layer);
      const publication = getPublication();
      if (publication) applyShareQualityChoice(publication, layer);
    },
    [getPublication, shareKey],
  );

  return { selectedId, selectedLayer, select };
}

/**
 * Publishes this tile's picker to the call toolbar while the tile shows a remote share. Only
 * re-publishes when what the menu shows changes (not on every render).
 */
export function usePublishShareQualityPicker(input: {
  enabled: boolean;
  shareKey: string | undefined;
  options: CallShareQualityOption[];
  selectedId: string;
  select: (option: CallShareQualityOption) => void;
}): void {
  const { enabled, shareKey, options, selectedId } = input;
  const selectRef = useRef(input.select);
  selectRef.current = input.select;
  const ownerRef = useRef<object>({});
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const signature = options
    .map((o) =>
      o.kind === 'layer' ? `${o.id}:${o.needsResize ? 1 : 0}` : o.id,
    )
    .join('|');

  useEffect(() => {
    const owner = ownerRef.current;
    if (!enabled || !shareKey) {
      publishShareQualityPicker(owner, null);
      return;
    }
    publishShareQualityPicker(owner, {
      shareKey,
      options: optionsRef.current,
      selectedId,
      select: (option) => selectRef.current(option),
    });
    return () => publishShareQualityPicker(owner, null);
  }, [enabled, shareKey, signature, selectedId]);
}
