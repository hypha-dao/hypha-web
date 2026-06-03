import { describe, expect, it } from 'vitest';

import {
  computeScreenshareFilmstripTileHeight,
  resolveScreenshareDockHeight,
  resolveScreenshareFilmstripContentWidth,
  resolveScreenshareFilmstripTilesPerPage,
  SCREENSHARE_FILMSTRIP,
  SCREENSHARE_FILMSTRIP_DOCK_WIDTH,
} from '../call-screenshare-filmstrip-geometry';

describe('call-screenshare-filmstrip-geometry', () => {
  it('computes 16:9 tile height from content width', () => {
    const contentWidth = resolveScreenshareFilmstripContentWidth();
    expect(computeScreenshareFilmstripTileHeight(contentWidth)).toBe(
      Math.round((contentWidth * 9) / 16),
    );
  });

  it('grows dock height with participant count up to the viewport cap', () => {
    const one = resolveScreenshareDockHeight({
      participantCount: 1,
      viewportMaxHeight: 900,
    });
    const three = resolveScreenshareDockHeight({
      participantCount: 3,
      viewportMaxHeight: 900,
    });
    expect(three).toBeGreaterThan(one);
  });

  it('reserves pagination space once the viewport cap is reached', () => {
    const capped = resolveScreenshareDockHeight({
      participantCount: 12,
      viewportMaxHeight: 420,
    });
    expect(capped).toBeLessThanOrEqual(420);
    expect(capped).toBeGreaterThanOrEqual(SCREENSHARE_FILMSTRIP.minDockHeight);
  });

  it('derives tiles per page from stage height', () => {
    const contentWidth = resolveScreenshareFilmstripContentWidth(
      SCREENSHARE_FILMSTRIP_DOCK_WIDTH,
    );
    const tileHeight = computeScreenshareFilmstripTileHeight(contentWidth);
    const stageHeight = tileHeight * 3 + SCREENSHARE_FILMSTRIP.tileGapPx * 2;
    expect(
      resolveScreenshareFilmstripTilesPerPage({
        stageHeight,
        contentWidth,
        needsPagination: false,
      }),
    ).toBe(3);
  });

  it('reserves compact PiP chrome for title row and footer toolbar', () => {
    expect(SCREENSHARE_FILMSTRIP.pipHeaderPx).toBe(28);
    expect(SCREENSHARE_FILMSTRIP.pipFooterPx).toBe(48);
    expect(
      SCREENSHARE_FILMSTRIP.pipFooterBannerPx -
        SCREENSHARE_FILMSTRIP.pipFooterPx,
    ).toBe(24);
  });
});
