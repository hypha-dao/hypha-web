/**
 * Draggable split ratios for full-view screen share + participants (§3.4.4.2).
 * @public
 */
export type CallFullViewPaneSplit = 'sideBySide' | 'filmstrip' | 'speakerOnTop';

export const CALL_FULL_VIEW_PANE_SPLIT_LS_KEY: Record<
  CallFullViewPaneSplit,
  string
> = {
  sideBySide: 'hypha.callFullView.split.sideBySide',
  filmstrip: 'hypha.callFullView.split.filmstrip',
  speakerOnTop: 'hypha.callFullView.split.speakerOnTop',
};

/**
 * Tuned to match previous fixed layouts (e.g. ~72% / 28% side-by-side,
 * screen share main band vs filmstrip).
 */
const DEFAULT_SPLIT: Record<CallFullViewPaneSplit, number> = {
  sideBySide: 0.68,
  filmstrip: 0.72,
  speakerOnTop: 0.28,
};

const MIN = 0.12;
const MAX = 0.9;

export function clampCallFullViewSplit(
  n: number,
  min: number = MIN,
  max: number = MAX,
): number {
  if (Number.isNaN(n) || n <= 0) return min;
  if (n >= 1) return max;
  return Math.min(max, Math.max(min, n));
}

export function readCallFullViewPaneSplit(
  which: CallFullViewPaneSplit,
): number {
  const d = DEFAULT_SPLIT[which];
  if (typeof window === 'undefined') return d;
  try {
    const raw = window.localStorage.getItem(
      CALL_FULL_VIEW_PANE_SPLIT_LS_KEY[which],
    );
    if (raw == null) return d;
    const p = parseFloat(raw);
    return Number.isFinite(p) ? clampCallFullViewSplit(p) : d;
  } catch {
    return d;
  }
}

export function persistCallFullViewPaneSplit(
  which: CallFullViewPaneSplit,
  value: number,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      CALL_FULL_VIEW_PANE_SPLIT_LS_KEY[which],
      String(clampCallFullViewSplit(value)),
    );
  } catch {
    /* private / quota */
  }
}
