import {
  clearMainColumnScrollFreeze,
  freezeMainColumnScrollAt,
  getMainColumnNaturalMaxScroll,
  getMainColumnScrollY,
  holdMainColumnScrollHeight,
  isMainColumnScrollFrozen,
  releaseMainColumnScrollHeightHold,
  scrollMainColumnTo,
} from '../common/main-column-scroll';

/** Survives the settings → overview remount. */
export const QUEST_DETAIL_SCROLL_KEY = 'hypha-quest-detail-scroll';

/**
 * The main column is the scrollport (`PanelScrollInset` / the dual-sidebar
 * column), not the window. A tab swap shrinks that column before the next
 * screen is tall, and the browser clamps `scrollTop` to 0. Hold the height
 * and pin the offset so the clamp cannot stick.
 */
export function rememberQuestDetailScroll(top: number): void {
  if (typeof window === 'undefined') return;
  const safe = Number.isFinite(top) ? Math.max(0, top) : 0;
  window.sessionStorage.setItem(QUEST_DETAIL_SCROLL_KEY, String(safe));
  holdMainColumnScrollHeight(Math.max(safe, 1));
  freezeMainColumnScrollAt(safe);
}

export function readQuestDetailScroll(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(QUEST_DETAIL_SCROLL_KEY);
  if (raw == null) return null;
  const top = Number(raw);
  return Number.isFinite(top) ? Math.max(0, top) : null;
}

export function clearQuestDetailScrollMemory(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(QUEST_DETAIL_SCROLL_KEY);
}

/**
 * Where a saved offset lands. A shorter overview keeps the offset when a
 * height hold can, and otherwise stops at the end of the real content.
 */
export function questDetailScrollTarget(
  saved: number,
  naturalMax: number,
): number {
  const safe = Number.isFinite(saved) ? Math.max(0, saved) : 0;
  const max = Number.isFinite(naturalMax) ? Math.max(0, naturalMax) : 0;
  return Math.min(safe, max);
}

function pageCanHold(saved: number, naturalMax: number): boolean {
  return naturalMax + 2 >= saved;
}

/**
 * Write `saved` onto the main column. While the next screen is still short,
 * keep the height hold so the space cover does not open.
 */
export function applyQuestDetailScroll(saved: number): void {
  const safe = Number.isFinite(saved) ? Math.max(0, saved) : 0;
  const max = getMainColumnNaturalMaxScroll();
  if (!pageCanHold(safe, max)) {
    holdMainColumnScrollHeight(Math.max(safe, 1));
    freezeMainColumnScrollAt(safe);
    return;
  }
  if (isMainColumnScrollFrozen()) clearMainColumnScrollFreeze();
  releaseMainColumnScrollHeightHold();
  scrollMainColumnTo(questDetailScrollTarget(safe, max));
}

/**
 * Re-apply across the frames where the space chrome and the route swap
 * clamp the column. Returns a cancel for unmount. Cancelling does not
 * release the hold — the next screen still needs it.
 */
export function retainQuestDetailScroll(saved: number): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const safe = Number.isFinite(saved) ? Math.max(0, saved) : 0;
  let cancelled = false;
  let frames = 0;
  let raf = 0;
  const tick = () => {
    if (cancelled) return;
    applyQuestDetailScroll(safe);
    frames += 1;
    if (frames >= 12) {
      const max = getMainColumnNaturalMaxScroll();
      if (pageCanHold(safe, max)) {
        if (isMainColumnScrollFrozen()) clearMainColumnScrollFreeze();
        releaseMainColumnScrollHeightHold();
        scrollMainColumnTo(questDetailScrollTarget(safe, max));
      } else {
        holdMainColumnScrollHeight(Math.max(safe, 1));
        clearMainColumnScrollFreeze();
        scrollMainColumnTo(safe);
      }
      clearQuestDetailScrollMemory();
      return;
    }
    raf = window.requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelled = true;
    if (raf) window.cancelAnimationFrame(raf);
  };
}
