import { describe, expect, it } from 'vitest';

import {
  CALL_FEED_VIDEO_LABEL_MIN_HEIGHT_CLASS,
  resolveCallFeedAudioScrimLayout,
  resolveCallFeedVideoParticipantLabelLayout,
} from '../call-feed-tile-chrome';

describe('resolveCallFeedAudioScrimLayout', () => {
  it('centers avatar, name, and waves in panel dock tiles', () => {
    const layout = resolveCallFeedAudioScrimLayout({
      isPip: false,
      isFullView: false,
      isDocumentPipOpen: false,
    });
    expect(layout.panelDockTile).toBe(true);
    expect(layout.scrimClass).toContain('items-center');
    expect(layout.scrimClass).toContain('justify-center');
    expect(layout.scrimClass).not.toContain('items-start');
    expect(layout.contentClass).toContain('items-center');
    expect(layout.avatarClass).toContain('h-10 w-10');
    expect(layout.waveClass).toContain('mx-auto');
  });

  it('centers content in full-view audio tiles', () => {
    const layout = resolveCallFeedAudioScrimLayout({
      isPip: false,
      isFullView: true,
      isDocumentPipOpen: false,
    });
    expect(layout.scrimClass).toContain('justify-center');
    expect(layout.avatarClass).toContain('h-20 w-20');
    expect(layout.waveSize).toBe('lg');
  });

  it('uses compact centered layout in PiP', () => {
    const layout = resolveCallFeedAudioScrimLayout({
      isPip: true,
      isFullView: false,
      isDocumentPipOpen: true,
    });
    expect(layout.scrimClass).toContain('justify-center');
    expect(layout.waveSize).toBe('sm');
  });
});

describe('resolveCallFeedVideoParticipantLabelLayout', () => {
  it('keeps label bar at the bottom with WCUX minimum height', () => {
    const dock = resolveCallFeedVideoParticipantLabelLayout({
      isFullView: false,
      compactTileLayout: false,
    });
    expect(dock.barClass).toContain(CALL_FEED_VIDEO_LABEL_MIN_HEIGHT_CLASS);
    expect(dock.barClass).toContain('bottom-1');
    expect(dock.barClass).toContain('inset-x-1');
    expect(dock.muteTextSrOnly).toBe(true);

    const full = resolveCallFeedVideoParticipantLabelLayout({
      isFullView: true,
      compactTileLayout: false,
    });
    expect(full.barClass).toContain('bottom-2');
    expect(full.barClass).toContain('inset-x-2');
    expect(full.muteTextSrOnly).toBe(false);
  });
});
