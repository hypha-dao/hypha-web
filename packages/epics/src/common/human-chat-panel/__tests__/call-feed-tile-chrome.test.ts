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
  it('uses a bottom-start floating chip (not a full-width bar)', () => {
    const dock = resolveCallFeedVideoParticipantLabelLayout({
      isFullView: false,
      compactTileLayout: false,
    });
    expect(dock.barClass).toContain(CALL_FEED_VIDEO_LABEL_MIN_HEIGHT_CLASS);
    expect(dock.barClass).toContain('w-max');
    expect(dock.barClass).toContain('start-1.5');
    expect(dock.barClass).toContain('bottom-1.5');
    expect(dock.barClass).toContain('rounded-md');
    expect(dock.barClass).not.toContain('inset-x-0');
    expect(dock.barClass).not.toContain('w-full');
    expect(dock.muteTextSrOnly).toBe(true);

    const pip = resolveCallFeedVideoParticipantLabelLayout({
      isFullView: false,
      compactTileLayout: true,
    });
    expect(pip.barClass).toContain('bottom-1');
    expect(pip.barClass).toContain('start-1');
    expect(pip.barClass).toContain('rounded-md');
    expect(pip.muteTextSrOnly).toBe(true);

    const full = resolveCallFeedVideoParticipantLabelLayout({
      isFullView: true,
      compactTileLayout: false,
    });
    expect(full.barClass).toContain('start-2');
    expect(full.barClass).toContain('bottom-2');
    expect(full.barClass).toContain('rounded-md');
    expect(full.barClass).not.toContain('inset-x-0');
    expect(full.muteTextSrOnly).toBe(false);
  });
});
