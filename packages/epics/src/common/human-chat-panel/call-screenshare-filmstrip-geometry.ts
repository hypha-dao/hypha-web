/** Narrow vertical dock / Document PiP while the presenter shares their screen. */
export const SCREENSHARE_FILMSTRIP_DOCK_WIDTH = 196;

export const SCREENSHARE_FILMSTRIP = {
  tileGapPx: 6,
  tilePaddingPx: 6,
  headerPx: 36,
  footerPx: 72,
  footerWithBannerPx: 124,
  /** Document PiP — compact title row with Space action. */
  pipHeaderPx: 28,
  pipFooterPx: 48,
  /** PiP footer + compact tab-audio action strip. */
  pipFooterBannerPx: 72,
  paginationPx: 28,
  minDockHeight: 280,
  /** Default PiP window height when opening during screen share. */
  defaultPipHeight: 480,
} as const;

export function computeScreenshareFilmstripTileHeight(
  contentWidth: number,
): number {
  const width = Math.max(96, Math.floor(contentWidth));
  return Math.round((width * 9) / 16);
}

export function resolveScreenshareFilmstripContentWidth(
  dockWidth = SCREENSHARE_FILMSTRIP_DOCK_WIDTH,
): number {
  return Math.max(96, dockWidth - 2 * SCREENSHARE_FILMSTRIP.tilePaddingPx);
}

export function resolveScreenshareFilmstripTilesPerPage(input: {
  stageHeight: number;
  contentWidth?: number;
  needsPagination: boolean;
}): number {
  const contentWidth =
    input.contentWidth ?? resolveScreenshareFilmstripContentWidth();
  const tileHeight = computeScreenshareFilmstripTileHeight(contentWidth);
  const tileBlock = tileHeight + SCREENSHARE_FILMSTRIP.tileGapPx;
  const paginationReserve = input.needsPagination
    ? SCREENSHARE_FILMSTRIP.paginationPx
    : 0;
  const available = Math.max(tileHeight, input.stageHeight - paginationReserve);
  return Math.max(
    1,
    Math.floor((available + SCREENSHARE_FILMSTRIP.tileGapPx) / tileBlock),
  );
}

export function resolveScreenshareDockHeight(input: {
  participantCount: number;
  showBanner?: boolean;
  /** Document PiP — omit dock title row from chrome. */
  documentPip?: boolean;
  /** Single-line / action-only banner (PiP tab audio strip). */
  compactBanner?: boolean;
  viewportMaxHeight?: number;
  dockWidth?: number;
}): number {
  const participantCount = Math.max(1, Math.floor(input.participantCount));
  const dockWidth = input.dockWidth ?? SCREENSHARE_FILMSTRIP_DOCK_WIDTH;
  const contentWidth = resolveScreenshareFilmstripContentWidth(dockWidth);
  const tileHeight = computeScreenshareFilmstripTileHeight(contentWidth);
  const tileBlock = tileHeight + SCREENSHARE_FILMSTRIP.tileGapPx;
  const header = input.documentPip
    ? SCREENSHARE_FILMSTRIP.pipHeaderPx
    : SCREENSHARE_FILMSTRIP.headerPx;
  const footer = input.showBanner
    ? input.compactBanner
      ? SCREENSHARE_FILMSTRIP.pipFooterBannerPx
      : SCREENSHARE_FILMSTRIP.footerWithBannerPx
    : input.documentPip
    ? SCREENSHARE_FILMSTRIP.pipFooterPx
    : SCREENSHARE_FILMSTRIP.footerPx;
  const chrome = header + footer;
  const viewportMax =
    input.viewportMaxHeight ??
    (typeof window !== 'undefined'
      ? Math.max(280, window.innerHeight - 32)
      : 560);

  const idealHeight =
    chrome + participantCount * tileBlock - SCREENSHARE_FILMSTRIP.tileGapPx;

  if (idealHeight <= viewportMax) {
    return Math.max(SCREENSHARE_FILMSTRIP.minDockHeight, idealHeight);
  }

  const stageMax = viewportMax - chrome - SCREENSHARE_FILMSTRIP.paginationPx;
  const tilesPerPage = Math.max(
    1,
    Math.floor((stageMax + SCREENSHARE_FILMSTRIP.tileGapPx) / tileBlock),
  );
  const visibleTiles = Math.min(participantCount, tilesPerPage);
  const paginatedHeight =
    chrome +
    visibleTiles * tileBlock -
    SCREENSHARE_FILMSTRIP.tileGapPx +
    SCREENSHARE_FILMSTRIP.paginationPx;

  return Math.min(
    viewportMax,
    Math.max(SCREENSHARE_FILMSTRIP.minDockHeight, paginatedHeight),
  );
}
