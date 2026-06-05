import { describe, expect, it } from 'vitest';

import {
  CALL_GALLERY_MAX_TILES_PER_PAGE,
  computeCallGalleryGrid,
  getCallGalleryPageCount,
  getCallGalleryTileColumnStart,
  sliceCallGalleryPage,
} from '../call-gallery-grid';

describe('computeCallGalleryGrid', () => {
  it('uses 2×2 for four participants', () => {
    expect(computeCallGalleryGrid(4)).toEqual({ cols: 2, rows: 2, slots: 4 });
  });

  it('uses 3×2 for five participants in full view', () => {
    expect(computeCallGalleryGrid(5)).toEqual({ cols: 3, rows: 2, slots: 6 });
  });

  it('uses 3×2 for six participants', () => {
    expect(computeCallGalleryGrid(6)).toEqual({ cols: 3, rows: 2, slots: 6 });
  });

  it('uses 5×4 for twenty participants', () => {
    expect(computeCallGalleryGrid(20)).toEqual({ cols: 5, rows: 4, slots: 20 });
  });

  it('respects a narrower max column cap (panel)', () => {
    expect(computeCallGalleryGrid(6, 2)).toEqual({
      cols: 2,
      rows: 3,
      slots: 6,
    });
  });
});

describe('getCallGalleryTileColumnStart', () => {
  it('centers a lone tile on the last row', () => {
    const layout = computeCallGalleryGrid(3);
    expect(getCallGalleryTileColumnStart(2, 3, layout)).toBe(2);
  });

  it('centers two tiles on the last row of five', () => {
    const layout = computeCallGalleryGrid(5);
    expect(getCallGalleryTileColumnStart(3, 5, layout)).toBe(2);
    expect(getCallGalleryTileColumnStart(4, 5, layout)).toBe(3);
  });
});

describe('gallery pagination', () => {
  it('splits more than 20 tiles across pages', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(getCallGalleryPageCount(items.length)).toBe(2);
    expect(sliceCallGalleryPage(items, 0)).toHaveLength(
      CALL_GALLERY_MAX_TILES_PER_PAGE,
    );
    expect(sliceCallGalleryPage(items, 1)).toHaveLength(5);
  });
});
