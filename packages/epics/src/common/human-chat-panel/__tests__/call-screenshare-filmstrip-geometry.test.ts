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
    expect(SCREENSHARE_FILMSTRIP.pipHeaderPx).toBe(24);
    expect(SCREENSHARE_FILMSTRIP.pipFooterPx).toBe(32);
    expect(
      SCREENSHARE_FILMSTRIP.pipFooterBannerPx -
        SCREENSHARE_FILMSTRIP.pipFooterPx,
    ).toBe(36);
  });

  it('sizes Document PiP stack layout for small groups without pagination', () => {
    const twoUp = resolveScreenshareDockHeight({
      participantCount: 2,
      documentPip: true,
      dockWidth: 224,
      viewportMaxHeight: 900,
    });
    const chrome =
      SCREENSHARE_FILMSTRIP.pipHeaderPx +
      SCREENSHARE_FILMSTRIP.pipFooterPx +
      SCREENSHARE_FILMSTRIP.pipBrowserChromePx;
    const expected =
      chrome +
      2 * SCREENSHARE_FILMSTRIP.pipStackMinTilePx +
      SCREENSHARE_FILMSTRIP.tileGapPx;
    expect(twoUp).toBe(expected);
  });

  it('sizes Document PiP to fit all participants before paginating', () => {
    const contentWidth = resolveScreenshareFilmstripContentWidth(224);
    const tileHeight = computeScreenshareFilmstripTileHeight(contentWidth);
    const fourUp = resolveScreenshareDockHeight({
      participantCount: 4,
      documentPip: true,
      dockWidth: 224,
      viewportMaxHeight: 900,
    });
    const stageHeight =
      fourUp -
      SCREENSHARE_FILMSTRIP.pipHeaderPx -
      SCREENSHARE_FILMSTRIP.pipFooterPx -
      SCREENSHARE_FILMSTRIP.pipBrowserChromePx;
    expect(
      resolveScreenshareFilmstripTilesPerPage({
        stageHeight,
        contentWidth,
        needsPagination: false,
      }),
    ).toBeGreaterThanOrEqual(2);
    expect(tileHeight).toBeGreaterThan(0);
  });

  it('does not force floating-dock min height on Document PiP', () => {
    const pipHeight = resolveScreenshareDockHeight({
      participantCount: 1,
      documentPip: true,
      dockWidth: 224,
      viewportMaxHeight: 900,
    });
    expect(pipHeight).toBeLessThan(SCREENSHARE_FILMSTRIP.minDockHeight);
  });
});
