import { describe, expect, it } from 'vitest';

import {
  resolveCallFullScreenLayoutMode,
  resolveCallGalleryTilePlacements,
  resolveCallStageLayout,
  resolveCallStageParticipantVideoFit,
  resolveCallViewportTier,
  resolveSpeakerPrimaryStripIndices,
} from '../call-stage-layout-engine';

describe('resolveCallViewportTier', () => {
  it('maps dock modes to viewport tiers', () => {
    expect(
      resolveCallViewportTier({
        dockMode: 'thumbnail',
        isDocumentPip: false,
        stageLayout: 'panel',
      }),
    ).toBe('V-S');
    expect(
      resolveCallViewportTier({
        dockMode: 'expanded',
        isDocumentPip: false,
        stageLayout: 'panel',
      }),
    ).toBe('V-M');
    expect(
      resolveCallViewportTier({
        dockMode: 'thumbnail',
        isDocumentPip: true,
        stageLayout: 'panel',
      }),
    ).toBe('V-PiP');
    expect(
      resolveCallViewportTier({
        dockMode: 'expanded',
        isDocumentPip: false,
        stageLayout: 'fullView',
      }),
    ).toBe('V-L');
  });
});

describe('resolveCallFullScreenLayoutMode', () => {
  it.each([
    [1, 'solo'],
    [2, 'duo'],
    [3, 'trio'],
    [4, 'quad'],
    [5, 'five'],
    [6, 'six'],
    [7, 'seven'],
    [8, 'eight'],
    [9, 'gallery'],
    [20, 'gallery'],
    [21, 'speakerGallery'],
    [30, 'speakerGallery'],
  ] as const)('maps N=%i to %s', (n, mode) => {
    expect(resolveCallFullScreenLayoutMode(n)).toBe(mode);
  });
});

describe('resolveCallStageLayout', () => {
  it('uses threshold gallery for full-screen N=5', () => {
    const plan = resolveCallStageLayout({
      viewportTier: 'V-L',
      participantDeviceCount: 5,
      hasActiveShare: false,
      activeSpeakerIndex: 0,
      galleryPage: 0,
    });
    expect(plan.renderer).toBe('thresholdGallery');
    expect(plan.fullScreenMode).toBe('five');
    expect(plan.galleryLayout).toEqual({ cols: 3, rows: 2, slots: 6 });
  });

  it('uses paginated gallery for full-screen N=9', () => {
    const plan = resolveCallStageLayout({
      viewportTier: 'V-L',
      participantDeviceCount: 9,
      hasActiveShare: false,
      activeSpeakerIndex: 0,
      galleryPage: 0,
    });
    expect(plan.renderer).toBe('paginatedGallery');
    expect(plan.fullScreenMode).toBe('gallery');
    expect(plan.showGalleryPagination).toBe(false);
  });

  it('uses speaker gallery for full-screen N=21+', () => {
    const plan = resolveCallStageLayout({
      viewportTier: 'V-L',
      participantDeviceCount: 25,
      hasActiveShare: false,
      activeSpeakerIndex: 3,
      galleryPage: 0,
    });
    expect(plan.renderer).toBe('speakerGallery');
    expect(plan.fullScreenMode).toBe('speakerGallery');
    expect(plan.stripOverflowCount).toBe(17);
  });

  it('uses speaker-primary strip in dock tiers when N>=2', () => {
    const plan = resolveCallStageLayout({
      viewportTier: 'V-M',
      participantDeviceCount: 4,
      hasActiveShare: false,
      activeSpeakerIndex: 1,
      galleryPage: 0,
    });
    expect(plan.renderer).toBe('speakerPrimaryStrip');
    expect(plan.participantVideoFit).toBe('contain');
    expect(plan.speakerPrimaryRatio).toBe(0.7);
  });

  it('defers to share layout when hasActiveShare', () => {
    const plan = resolveCallStageLayout({
      viewportTier: 'V-L',
      participantDeviceCount: 6,
      hasActiveShare: true,
      activeSpeakerIndex: 0,
      galleryPage: 0,
    });
    expect(plan.renderer).toBe('legacyGrid');
  });
});

describe('resolveCallGalleryTilePlacements', () => {
  it('promotes active speaker in trio layout', () => {
    const placements = resolveCallGalleryTilePlacements('trio', 3, 2);
    expect(placements[2]).toMatchObject({
      gridColumnStart: 1,
      gridRowStart: 1,
      gridRowEnd: 3,
    });
  });

  it('promotes active speaker in seven layout', () => {
    const placements = resolveCallGalleryTilePlacements('seven', 7, 4);
    expect(placements[4]).toMatchObject({
      gridColumnStart: 1,
      gridRowStart: 1,
      gridColumnEnd: 3,
      gridRowEnd: 3,
    });
  });
});

describe('resolveCallStageParticipantVideoFit', () => {
  it('uses contain for multi-participant dock tiers', () => {
    expect(
      resolveCallStageParticipantVideoFit({
        viewportTier: 'V-S',
        participantDeviceCount: 3,
      }),
    ).toBe('contain');
    expect(
      resolveCallStageParticipantVideoFit({
        viewportTier: 'V-M',
        participantDeviceCount: 2,
      }),
    ).toBe('contain');
  });

  it('allows cover for solo tiles', () => {
    expect(
      resolveCallStageParticipantVideoFit({
        viewportTier: 'V-S',
        participantDeviceCount: 1,
      }),
    ).toBe('cover');
  });
});

describe('resolveSpeakerPrimaryStripIndices', () => {
  it('keeps active speaker primary and caps strip faces', () => {
    expect(resolveSpeakerPrimaryStripIndices(8, 2, 6)).toEqual({
      speakerIndex: 2,
      stripIndices: [0, 1, 3, 4, 5, 6],
      overflowCount: 1,
    });
  });
});
