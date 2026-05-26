/** Tailwind `md` breakpoint — keep in sync with `packages/ui/src/breakpoints.ts`. */
const MD_BREAKPOINT_PX = 768;

/** Rows revealed per "Load more" — keeps the grid from ending mid-row. */
export const SIGNAL_GRID_ROW_BATCH_COUNT = 3;

/** Matches {@link SignalGrid} `minmax(min(100%, 14.25rem), 1fr)`. */
export const SIGNAL_GRID_MIN_COLUMN_REM = 14.25;

/** Matches {@link SignalGrid} `gap-2`. */
export const SIGNAL_GRID_GAP_REM = 0.5;

export function remPx(rem: number): number {
  if (typeof document === 'undefined') return rem * 16;
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return rem * (Number.isFinite(root) && root > 0 ? root : 16);
}

/**
 * Column count for the signal auto-fill grid (md+), or 1 below the md breakpoint.
 * Mirrors CSS `repeat(auto-fill, minmax(min(100%, 14.25rem), 1fr))`.
 */
export function computeSignalGridColumns(
  containerWidthPx: number,
  viewportWidthPx: number,
): number {
  if (viewportWidthPx < MD_BREAKPOINT_PX) return 1;
  const width = Math.max(0, containerWidthPx);
  const minColumnPx = Math.min(width, remPx(SIGNAL_GRID_MIN_COLUMN_REM));
  const gapPx = remPx(SIGNAL_GRID_GAP_REM);
  return Math.max(1, Math.floor((width + gapPx) / (minColumnPx + gapPx)));
}

export function computeSignalGridRowBatchSize(
  containerWidthPx: number,
  viewportWidthPx: number,
): number {
  return (
    computeSignalGridColumns(containerWidthPx, viewportWidthPx) *
    SIGNAL_GRID_ROW_BATCH_COUNT
  );
}

/** Snap a visible count down to full rows when column count changes. */
export function alignSignalVisibleCount(
  count: number,
  rowBatchSize: number,
): number {
  if (rowBatchSize <= 0) return count;
  const columns = rowBatchSize / SIGNAL_GRID_ROW_BATCH_COUNT;
  if (columns <= 0 || !Number.isFinite(columns)) return count;
  if (count <= rowBatchSize) return rowBatchSize;
  const aligned = Math.floor(count / columns) * columns;
  return Math.max(rowBatchSize, aligned);
}
