import {
  clearMainColumnScrollFreeze,
  getMainColumnNaturalMaxScroll,
  getMainColumnScrollElement,
  holdMainColumnScrollHeight,
  isMainColumnScrollFrozen,
  releaseMainColumnScrollHeightHold,
} from '../common/main-column-scroll';

/** Survives the settings → overview remount. */
export const QUEST_DETAIL_SCROLL_KEY = 'hypha-quest-detail-scroll';

/** Tabs row whose viewport Y is the view we put back. */
export const QUEST_DETAIL_TABS_SELECTOR = '[data-quest-detail-tabs]';

/**
 * Marks the element that was actually scrolling when the member saved.
 * The registered main-column root can be a different node (scrollTop 0)
 * while a parent is the scroller that moved the hero.
 */
const SCROLLPORT_ATTR = 'data-quest-detail-scrollport';

const SETTLED_ATTR = 'data-quest-scroll-settled';

/**
 * Space chrome releases a short-page hold on the 2nd frame after its
 * pathname layout effect, and again ~48ms later if a freeze was left
 * behind. Child layout effects run first, so those writes land after
 * the first restore. Keep correcting past both.
 */
const MIN_FRAMES = 10;
const MAX_FRAMES = 24;

export type QuestDetailScrollAnchor = {
  scrollTop: number;
  /** Viewport Y of the tabs row. Null when the row was not in the DOM. */
  tabsTop: number | null;
};

type Pin = {
  port: HTMLElement;
  onScroll: () => void;
  onIntent: () => void;
  timer: number;
};

let pin: Pin | null = null;
let applying = false;

function tabsElement(): HTMLElement | null {
  const el = document.querySelector(QUEST_DETAIL_TABS_SELECTOR);
  return el instanceof HTMLElement ? el : null;
}

function markedPort(): HTMLElement | null {
  const el = document.querySelector(`[${SCROLLPORT_ATTR}]`);
  return el instanceof HTMLElement ? el : null;
}

function markPort(port: HTMLElement): void {
  const current = markedPort();
  if (current && current !== port) current.removeAttribute(SCROLLPORT_ATTR);
  port.setAttribute(SCROLLPORT_ATTR, '');
}

function clearMark(): void {
  markedPort()?.removeAttribute(SCROLLPORT_ATTR);
}

/**
 * The scroller that contains the tabs. Prefer whichever overflow ancestor
 * (or the registered root) actually has a scroll offset. After a clamp to
 * 0, the mark written at capture time is the same element.
 */
export function findQuestDetailScrollport(
  anchor: Element | null,
): HTMLElement | null {
  const root = getMainColumnScrollElement();
  const candidates: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const add = (el: HTMLElement | null) => {
    if (!el || seen.has(el)) return;
    seen.add(el);
    candidates.push(el);
  };

  let node: HTMLElement | null =
    anchor instanceof HTMLElement
      ? anchor.parentElement
      : tabsElement()?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      overflowY === 'overlay'
    ) {
      add(node);
    }
    node = node.parentElement;
  }
  add(root);
  add(markedPort());
  const scrolling = document.scrollingElement;
  if (scrolling instanceof HTMLElement) add(scrolling);

  let best: HTMLElement | null = null;
  let bestTop = 0;
  for (const el of candidates) {
    if (el.scrollTop > bestTop + 0.5) {
      best = el;
      bestTop = el.scrollTop;
    }
  }
  if (best) return best;
  const marked = markedPort();
  if (marked && candidates.includes(marked)) return marked;
  if (root && candidates.includes(root)) return root;
  if (marked) return marked;
  return root ?? (scrolling instanceof HTMLElement ? scrolling : null);
}

function writeAnchor(anchor: QuestDetailScrollAnchor): void {
  window.sessionStorage.setItem(
    QUEST_DETAIL_SCROLL_KEY,
    JSON.stringify(anchor),
  );
}

export function readQuestDetailScrollAnchor(): QuestDetailScrollAnchor | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(QUEST_DETAIL_SCROLL_KEY);
  if (raw == null) return null;
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Partial<QuestDetailScrollAnchor>;
      const scrollTop = Number(parsed.scrollTop);
      if (!Number.isFinite(scrollTop)) return null;
      const tabsTop = Number(parsed.tabsTop);
      return {
        scrollTop: Math.max(0, scrollTop),
        tabsTop: Number.isFinite(tabsTop) ? tabsTop : null,
      };
    } catch {
      return null;
    }
  }
  const top = Number(raw);
  if (!Number.isFinite(top)) return null;
  return { scrollTop: Math.max(0, top), tabsTop: null };
}

export function readQuestDetailScroll(): number | null {
  return readQuestDetailScrollAnchor()?.scrollTop ?? null;
}

export function clearQuestDetailScrollMemory(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(QUEST_DETAIL_SCROLL_KEY);
  clearMark();
}

export function releaseQuestDetailScrollPin(): void {
  if (typeof window === 'undefined' || !pin) return;
  pin.port.removeEventListener('scroll', pin.onScroll);
  window.removeEventListener('wheel', pin.onIntent, true);
  window.removeEventListener('touchmove', pin.onIntent, true);
  window.clearTimeout(pin.timer);
  pin = null;
}

function writeScrollTop(port: HTMLElement, top: number): void {
  if (Math.abs(port.scrollTop - top) > 0.5) port.scrollTop = top;
}

function holdPort(port: HTMLElement, top: number): void {
  const root = getMainColumnScrollElement();
  const portHeight = port.clientHeight || window.innerHeight;
  const rootHeight = root?.clientHeight ?? portHeight;
  // The shared hold sizes itself from the registered root. A different
  // scroller needs the extra viewport height or the offset still clamps.
  const extra = root === port ? 0 : Math.max(0, portHeight - rootHeight);
  holdMainColumnScrollHeight(Math.max(top + extra, 1));
}

/**
 * Put the saved view back on the scroller that owns it. A short overview
 * keeps the height hold so the tabs can sit where they sat on settings.
 * Does not freeze: a freeze makes the space chrome treat the next screen
 * as keep-freeze and call releaseColumnToTop().
 */
export function restoreQuestDetailView(
  anchor: QuestDetailScrollAnchor,
): boolean {
  if (applying) return false;
  const tabs = tabsElement();
  const port = findQuestDetailScrollport(tabs);
  if (!port) return false;

  let next = anchor.scrollTop;
  if (tabs && anchor.tabsTop != null) {
    const delta = tabs.getBoundingClientRect().top - anchor.tabsTop;
    if (Number.isFinite(delta)) next = port.scrollTop + delta;
  }
  if (!Number.isFinite(next)) next = anchor.scrollTop;
  next = Math.max(0, next);

  applying = true;
  try {
    if (isMainColumnScrollFrozen()) clearMainColumnScrollFreeze();
    const root = getMainColumnScrollElement();
    const natural =
      root === port || root == null ? getMainColumnNaturalMaxScroll() : 0;
    if ((root === port || root == null) && natural + 2 >= next) {
      releaseMainColumnScrollHeightHold();
    } else {
      holdPort(port, next);
    }
    writeScrollTop(port, next);
    if (port.scrollTop + 1 < next) {
      holdPort(port, next);
      writeScrollTop(port, next);
    }
  } finally {
    applying = false;
  }

  if (!tabs || anchor.tabsTop == null) {
    return Math.abs(port.scrollTop - anchor.scrollTop) <= 2;
  }
  return Math.abs(tabs.getBoundingClientRect().top - anchor.tabsTop) <= 2;
}

function attachPin(port: HTMLElement): void {
  releaseQuestDetailScrollPin();
  const onScroll = () => {
    const anchor = readQuestDetailScrollAnchor();
    if (!anchor) return;
    restoreQuestDetailView(anchor);
  };
  const onIntent = () => {
    // The member took the scroller. Leave it where they put it.
    clearQuestDetailScrollMemory();
    releaseQuestDetailScrollPin();
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute(SETTLED_ATTR, 'user');
    }
  };
  const timer = window.setTimeout(() => {
    releaseQuestDetailScrollPin();
  }, 1500);
  pin = { port, onScroll, onIntent, timer };
  port.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('wheel', onIntent, { capture: true, passive: true });
  window.addEventListener('touchmove', onIntent, {
    capture: true,
    passive: true,
  });
}

/**
 * Remember the view and hold the column so the route swap cannot clamp it
 * to the hero before overview mounts. Does not start the restore loop:
 * settings can hold this offset, and finishing the loop there deletes the
 * pin before the next screen commits.
 */
export function captureQuestDetailView(): QuestDetailScrollAnchor | null {
  if (typeof window === 'undefined') return null;
  const tabs = tabsElement();
  const port = findQuestDetailScrollport(tabs);
  if (!port) return null;
  markPort(port);
  const anchor: QuestDetailScrollAnchor = {
    scrollTop: port.scrollTop,
    tabsTop: tabs ? tabs.getBoundingClientRect().top : null,
  };
  writeAnchor(anchor);
  document.documentElement.removeAttribute(SETTLED_ATTR);
  holdPort(port, Math.max(anchor.scrollTop, 1));
  attachPin(port);
  return anchor;
}

/** @deprecated Capture the live scroller via {@link captureQuestDetailView}. */
export function rememberQuestDetailScroll(top: number): void {
  if (typeof window === 'undefined') return;
  const safe = Number.isFinite(top) ? Math.max(0, top) : 0;
  const tabs = tabsElement();
  const port = findQuestDetailScrollport(tabs);
  if (port) markPort(port);
  writeAnchor({
    scrollTop: safe,
    tabsTop: tabs ? tabs.getBoundingClientRect().top : null,
  });
  if (port) holdPort(port, Math.max(safe, 1));
  else holdMainColumnScrollHeight(Math.max(safe, 1));
}

/**
 * Where a saved offset lands when the caller wants the natural end of the
 * column. The settings save does not use this: a short overview keeps the
 * saved view with a height hold instead of clamping to the hero.
 */
export function questDetailScrollTarget(
  saved: number,
  naturalMax: number,
): number {
  const safe = Number.isFinite(saved) ? Math.max(0, saved) : 0;
  const max = Number.isFinite(naturalMax) ? Math.max(0, naturalMax) : 0;
  return Math.min(safe, max);
}

/** Write `saved` onto the quest scroller. */
export function applyQuestDetailScroll(saved: number): void {
  const existing = readQuestDetailScrollAnchor();
  restoreQuestDetailView({
    scrollTop: Number.isFinite(saved) ? Math.max(0, saved) : 0,
    tabsTop: existing?.tabsTop ?? null,
  });
}

function settle(anchor: QuestDetailScrollAnchor, aligned: boolean): void {
  restoreQuestDetailView(anchor);
  clearQuestDetailScrollMemory();
  releaseQuestDetailScrollPin();
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute(
      SETTLED_ATTR,
      aligned ? 'ok' : 'miss',
    );
  }
}

/**
 * Re-apply until the tabs row is back and the space chrome has finished
 * releasing short-page holds. Returns a cancel for unmount. Cancelling
 * does not drop the anchor or the hold — overview still needs them.
 */
export function retainQuestDetailScroll(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const anchor = readQuestDetailScrollAnchor();
  if (!anchor) return () => undefined;

  let cancelled = false;
  let frames = 0;
  let stable = 0;
  let raf = 0;

  const tick = () => {
    if (cancelled) return;
    const current = readQuestDetailScrollAnchor();
    if (!current) return;
    const aligned = restoreQuestDetailView(current);
    frames += 1;
    stable = aligned ? stable + 1 : 0;
    const held = frames >= MIN_FRAMES && aligned && stable >= 3;
    if (held || frames >= MAX_FRAMES) {
      settle(current, aligned);
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
