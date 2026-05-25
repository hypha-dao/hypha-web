/** Minimum participants before switching from legacy layout to gallery grid. */
export const CALL_GALLERY_MIN_PARTICIPANTS = 4;

/** Zoom-style cap: up to this many tiles per full-screen gallery page. */
export const CALL_GALLERY_MAX_TILES_PER_PAGE = 20;

export type CallGalleryGridLayout = {
  cols: number;
  rows: number;
  slots: number;
};

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

/**
 * Balanced cols × rows for N tiles. Prefers fewer empty cells and roughly
 * landscape-friendly grids (max 5×5 for the 20-tile page cap).
 */
export function computeCallGalleryGrid(
  tileCount: number,
  maxCols = 5,
): CallGalleryGridLayout {
  const n = clampInt(tileCount, 1, CALL_GALLERY_MAX_TILES_PER_PAGE);
  const colsCap = clampInt(maxCols, 1, 5);

  if (n === 1) return { cols: 1, rows: 1, slots: 1 };
  if (n === 2) return { cols: Math.min(2, colsCap), rows: 1, slots: 2 };
  if (n === 3) {
    const cols = Math.min(2, colsCap);
    return { cols, rows: 2, slots: cols * 2 };
  }
  if (n === 4) {
    const cols = Math.min(2, colsCap);
    return { cols, rows: 2, slots: cols * 2 };
  }
  if (colsCap >= 3) {
    if (n === 5 || n === 6) return { cols: 3, rows: 2, slots: 6 };
    if (n === 7 || n === 8 || n === 9) return { cols: 3, rows: 3, slots: 9 };
  }

  let best: CallGalleryGridLayout = {
    cols: Math.min(2, colsCap),
    rows: Math.ceil(n / Math.min(2, colsCap)),
    slots: 0,
  };
  best.slots = best.cols * best.rows;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let cols = 2; cols <= colsCap; cols++) {
    const rows = Math.ceil(n / cols);
    if (rows > 5) continue;
    const slots = cols * rows;
    const waste = slots - n;
    const squareness = Math.abs(cols / rows - 16 / 9);
    const score = waste * 100 + squareness;
    if (score < bestScore) {
      bestScore = score;
      best = { cols, rows, slots };
    }
  }

  return best;
}

/** Center a short last row inside the computed column count. */
export function getCallGalleryTileColumnStart(
  index: number,
  tileCount: number,
  layout: CallGalleryGridLayout,
): number | undefined {
  const { cols } = layout;
  const n = clampInt(tileCount, 1, CALL_GALLERY_MAX_TILES_PER_PAGE);
  if (cols <= 1 || n <= cols) return undefined;

  const fullRows = Math.floor(n / cols);
  const lastRowCount = n % cols;
  if (lastRowCount === 0) return undefined;
  if (index < fullRows * cols) return undefined;

  const offset = Math.round((cols - lastRowCount) / 2);
  const posInLastRow = index - fullRows * cols;
  return offset + posInLastRow + 1;
}

export function getCallGalleryPageCount(
  tileCount: number,
  pageSize = CALL_GALLERY_MAX_TILES_PER_PAGE,
): number {
  const n = Math.max(0, Math.floor(tileCount));
  if (n === 0) return 1;
  return Math.ceil(n / pageSize);
}

export function sliceCallGalleryPage<T>(
  items: readonly T[],
  page: number,
  pageSize = CALL_GALLERY_MAX_TILES_PER_PAGE,
): T[] {
  if (items.length === 0) return [];
  const pages = getCallGalleryPageCount(items.length, pageSize);
  const safePage = clampInt(page, 0, Math.max(0, pages - 1));
  const start = safePage * pageSize;
  return items.slice(start, start + pageSize);
}

export function callGalleryGridStyle(layout: CallGalleryGridLayout): {
  gridTemplateColumns: string;
  gridTemplateRows: string;
} {
  return {
    gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
  };
}
