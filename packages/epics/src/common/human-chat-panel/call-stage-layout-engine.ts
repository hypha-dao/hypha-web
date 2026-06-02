import {
  CALL_GALLERY_MAX_TILES_PER_PAGE,
  computeCallGalleryGrid,
  type CallGalleryGridLayout,
} from './call-gallery-grid';

/** Viewport tier from dock chrome (WCUX spec §3.1). */
export type CallViewportTier = 'V-S' | 'V-M' | 'V-L' | 'V-PiP';

/** Full-screen threshold layout mode (WCUX spec §3.2). */
export type CallFullScreenLayoutMode =
  | 'solo'
  | 'duo'
  | 'trio'
  | 'quad'
  | 'five'
  | 'six'
  | 'seven'
  | 'eight'
  | 'gallery'
  | 'speakerGallery';

export type CallStageLayoutRenderer =
  | 'soloTile'
  | 'thresholdGallery'
  | 'paginatedGallery'
  | 'speakerGallery'
  | 'speakerPrimaryStrip'
  | 'legacyGrid';

export type CallGalleryTilePlacement = {
  index: number;
  gridColumnStart?: number;
  gridRowStart?: number;
  gridColumnEnd?: number;
  gridRowEnd?: number;
};

export type CallStageLayoutInput = {
  viewportTier: CallViewportTier;
  participantDeviceCount: number;
  hasActiveShare: boolean;
  activeSpeakerIndex: number;
  galleryPage: number;
  isPortrait?: boolean;
};

export type CallStageLayoutPlan = {
  renderer: CallStageLayoutRenderer;
  fullScreenMode: CallFullScreenLayoutMode | null;
  participantVideoFit: 'cover' | 'contain';
  galleryMaxCols: number;
  galleryLayout: CallGalleryGridLayout | null;
  showGalleryPagination: boolean;
  speakerPrimaryRatio: number;
  stripMaxVisible: number;
  stripOverflowCount: number;
  tilePlacements: CallGalleryTilePlacement[];
  /** Keys that should reset gallery pagination when changed (WCUX-LAYOUT-7). */
  galleryPaginationResetKey: string;
};

export function resolveCallViewportTier(input: {
  dockMode: 'thumbnail' | 'expanded' | 'fullscreen';
  isDocumentPip: boolean;
  stageLayout: 'panel' | 'fullView';
}): CallViewportTier {
  if (input.isDocumentPip) return 'V-PiP';
  if (input.stageLayout === 'fullView' || input.dockMode === 'fullscreen') {
    return 'V-L';
  }
  if (input.dockMode === 'expanded') return 'V-M';
  return 'V-S';
}

export function resolveCallFullScreenLayoutMode(
  participantCount: number,
): CallFullScreenLayoutMode {
  const n = Math.max(0, Math.floor(participantCount));
  if (n <= 1) return 'solo';
  if (n === 2) return 'duo';
  if (n === 3) return 'trio';
  if (n === 4) return 'quad';
  if (n === 5) return 'five';
  if (n === 6) return 'six';
  if (n === 7) return 'seven';
  if (n === 8) return 'eight';
  if (n <= CALL_GALLERY_MAX_TILES_PER_PAGE) return 'gallery';
  return 'speakerGallery';
}

export function resolveCallStageParticipantVideoFit(input: {
  viewportTier: CallViewportTier;
  participantDeviceCount: number;
}): 'cover' | 'contain' {
  if (input.participantDeviceCount <= 1) return 'cover';
  if (
    input.viewportTier === 'V-S' ||
    input.viewportTier === 'V-M' ||
    input.viewportTier === 'V-PiP'
  ) {
    return 'contain';
  }
  return 'contain';
}

function clampSpeakerIndex(index: number, tileCount: number): number {
  if (tileCount <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(index), tileCount - 1));
}

/** Grid spans for threshold layouts with an enlarged active speaker tile. */
export function resolveCallGalleryTilePlacements(
  mode: CallFullScreenLayoutMode,
  tileCount: number,
  activeSpeakerIndex: number,
): CallGalleryTilePlacement[] {
  const n = Math.max(0, Math.floor(tileCount));
  if (n === 0) return [];
  const speaker = clampSpeakerIndex(activeSpeakerIndex, n);
  const placements: CallGalleryTilePlacement[] = Array.from(
    { length: n },
    (_, index) => ({
      index,
    }),
  );

  if (mode === 'five' && n === 5) {
    for (let i = 0; i < 3; i += 1) {
      placements[i] = {
        index: i,
        gridColumnStart: i + 1,
        gridRowStart: 1,
      };
    }
    /** Bottom row: two tiles span all three columns — no empty grid cell (WCUX-LAYOUT-2). */
    placements[3] = {
      index: 3,
      gridColumnStart: 1,
      gridColumnEnd: 2,
      gridRowStart: 2,
    };
    placements[4] = {
      index: 4,
      gridColumnStart: 2,
      gridColumnEnd: 4,
      gridRowStart: 2,
    };
    return placements;
  }

  if (mode === 'trio' && n === 3) {
    placements[speaker] = {
      index: speaker,
      gridColumnStart: 1,
      gridRowStart: 1,
      gridRowEnd: 3,
    };
    let slot = 0;
    for (let i = 0; i < n; i++) {
      if (i === speaker) continue;
      placements[i] = {
        index: i,
        gridColumnStart: 2,
        gridRowStart: slot + 1,
      };
      slot += 1;
    }
    return placements;
  }

  return placements;
}

export function resolveCallStageLayout(
  input: CallStageLayoutInput,
): CallStageLayoutPlan {
  const participantCount = Math.max(
    0,
    Math.floor(input.participantDeviceCount),
  );
  const speakerIndex = clampSpeakerIndex(
    input.activeSpeakerIndex,
    participantCount,
  );
  const participantVideoFit = resolveCallStageParticipantVideoFit({
    viewportTier: input.viewportTier,
    participantDeviceCount: participantCount,
  });
  const galleryPaginationResetKey = `${participantCount}|${
    input.hasActiveShare ? 'share' : 'camera'
  }`;

  if (input.hasActiveShare) {
    return {
      renderer: 'legacyGrid',
      fullScreenMode: null,
      participantVideoFit,
      galleryMaxCols: input.viewportTier === 'V-L' ? 5 : 2,
      galleryLayout: null,
      showGalleryPagination: false,
      speakerPrimaryRatio: 0.7,
      stripMaxVisible: 5,
      stripOverflowCount: 0,
      tilePlacements: [],
      galleryPaginationResetKey,
    };
  }

  const isDockTier =
    input.viewportTier === 'V-S' ||
    input.viewportTier === 'V-M' ||
    input.viewportTier === 'V-PiP';

  if (isDockTier) {
    if (participantCount <= 1) {
      return {
        renderer: 'soloTile',
        fullScreenMode: 'solo',
        participantVideoFit,
        galleryMaxCols: 2,
        galleryLayout: null,
        showGalleryPagination: false,
        speakerPrimaryRatio: 1,
        stripMaxVisible: 0,
        stripOverflowCount: 0,
        tilePlacements: [],
        galleryPaginationResetKey,
      };
    }

    const stripMaxVisible = participantCount >= 7 ? 6 : 5;
    const stripOverflowCount =
      participantCount > stripMaxVisible + 1
        ? participantCount - stripMaxVisible - 1
        : 0;
    const speakerPrimaryRatio =
      participantCount >= 7 ? 0.75 : participantCount === 2 ? 0.65 : 0.7;

    return {
      renderer: 'speakerPrimaryStrip',
      fullScreenMode: null,
      participantVideoFit,
      galleryMaxCols: 2,
      galleryLayout: null,
      showGalleryPagination: false,
      speakerPrimaryRatio,
      stripMaxVisible,
      stripOverflowCount,
      tilePlacements: [],
      galleryPaginationResetKey,
    };
  }

  const fullScreenMode = resolveCallFullScreenLayoutMode(participantCount);

  if (fullScreenMode === 'solo') {
    return {
      renderer: 'soloTile',
      fullScreenMode,
      participantVideoFit,
      galleryMaxCols: 5,
      galleryLayout: computeCallGalleryGrid(1, 5),
      showGalleryPagination: false,
      speakerPrimaryRatio: 1,
      stripMaxVisible: 0,
      stripOverflowCount: 0,
      tilePlacements: [],
      galleryPaginationResetKey,
    };
  }

  if (fullScreenMode === 'speakerGallery') {
    return {
      renderer: 'speakerGallery',
      fullScreenMode,
      participantVideoFit,
      galleryMaxCols: 5,
      galleryLayout: null,
      showGalleryPagination: true,
      speakerPrimaryRatio: 0.68,
      stripMaxVisible: 7,
      stripOverflowCount: Math.max(0, participantCount - 8),
      tilePlacements: [],
      galleryPaginationResetKey,
    };
  }

  if (fullScreenMode === 'gallery') {
    const galleryLayout = computeCallGalleryGrid(
      Math.min(participantCount, CALL_GALLERY_MAX_TILES_PER_PAGE),
      5,
    );
    return {
      renderer: 'paginatedGallery',
      fullScreenMode,
      participantVideoFit,
      galleryMaxCols: 5,
      galleryLayout,
      showGalleryPagination: participantCount > CALL_GALLERY_MAX_TILES_PER_PAGE,
      speakerPrimaryRatio: 1,
      stripMaxVisible: 0,
      stripOverflowCount: 0,
      tilePlacements: [],
      galleryPaginationResetKey,
    };
  }

  const galleryLayout = computeCallGalleryGrid(participantCount, 5);
  return {
    renderer: 'thresholdGallery',
    fullScreenMode,
    participantVideoFit,
    galleryMaxCols: 5,
    galleryLayout,
    showGalleryPagination: false,
    speakerPrimaryRatio: 1,
    stripMaxVisible: 0,
    stripOverflowCount: 0,
    tilePlacements: resolveCallGalleryTilePlacements(
      fullScreenMode,
      participantCount,
      speakerIndex,
    ),
    galleryPaginationResetKey,
  };
}

export function resolveSpeakerPrimaryStripIndices(
  tileCount: number,
  activeSpeakerIndex: number,
  stripMaxVisible: number,
): { speakerIndex: number; stripIndices: number[]; overflowCount: number } {
  const n = Math.max(0, Math.floor(tileCount));
  if (n === 0) {
    return { speakerIndex: 0, stripIndices: [], overflowCount: 0 };
  }
  const speakerIndex = clampSpeakerIndex(activeSpeakerIndex, n);
  const others = Array.from({ length: n }, (_, i) => i).filter(
    (i) => i !== speakerIndex,
  );
  const stripIndices = others.slice(0, stripMaxVisible);
  const overflowCount = Math.max(0, others.length - stripIndices.length);
  return { speakerIndex, stripIndices, overflowCount };
}
