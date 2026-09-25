'use client';

import { useSyncExternalStore } from 'react';

/**
 * Scroll position for the primary app column. When space side panels wrap content in
 * `SidebarInset` with `overflow-y-auto`, the document does not scroll — this module
 * tracks whichever element is the current scroll root (inset or window).
 */

let scrollRoot: HTMLElement | null = null;
const listeners = new Set<() => void>();
let scrollNotifyRaf = 0;

function readScrollY(): number {
  if (typeof window === 'undefined') return 0;
  if (scrollRoot) return scrollRoot.scrollTop;
  return window.scrollY;
}

function onScroll() {
  if (scrollNotifyRaf) return;
  scrollNotifyRaf = requestAnimationFrame(() => {
    scrollNotifyRaf = 0;
    listeners.forEach((l) => l());
  });
}

function detachFrom(target: HTMLElement | Window | null) {
  if (scrollNotifyRaf) {
    cancelAnimationFrame(scrollNotifyRaf);
    scrollNotifyRaf = 0;
  }
  if (!target) return;
  target.removeEventListener('scroll', onScroll);
}

function attachScrollTarget() {
  if (listeners.size === 0) return;
  if (scrollRoot) {
    scrollRoot.addEventListener('scroll', onScroll, { passive: true });
  } else if (typeof window !== 'undefined') {
    window.addEventListener('scroll', onScroll, { passive: true });
  }
}

/**
 * Called from the scrollable `SidebarInset` ref (or `null` on unmount).
 * When panels are off, root stays `null` and we fall back to `window`.
 */
export function setMainColumnScrollRoot(el: HTMLElement | null) {
  if (scrollRoot === el) return;
  const prev: HTMLElement | Window | null =
    scrollRoot ?? (typeof window !== 'undefined' ? window : null);
  detachFrom(prev);
  scrollRoot = el;
  attachScrollTarget();
  bindFreezeListener();
  listeners.forEach((l) => l());
}

/** Subscribe to scroll on the main column (inset or window). Safe for non-React listeners. */
export function subscribeMainColumnScroll(onStoreChange: () => void) {
  const wasEmpty = listeners.size === 0;
  listeners.add(onStoreChange);
  if (wasEmpty) attachScrollTarget();
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) {
      const target: HTMLElement | Window | null =
        scrollRoot ?? (typeof window !== 'undefined' ? window : null);
      detachFrom(target);
    }
  };
}

/** Current vertical scroll of the main column (inset or window). */
export function getMainColumnScrollY(): number {
  return readScrollY();
}

/** Scrollport for the main column, or null when the window scrolls. */
export function getMainColumnScrollElement(): HTMLElement | null {
  return scrollRoot;
}

/** Never request a negative offset — that elastic-overscrolls the banner below the menu. */
function clampScrollTop(top: number): number {
  if (!Number.isFinite(top)) return 0;
  return Math.max(0, top);
}

/**
 * While set, any scroll of the main column is pulled back to this offset.
 * Used across in-space route changes so Next.js scroll / content-height
 * clamping cannot flash the space header before paint.
 */
let frozenScrollTop: number | null = null;
let freezeTarget: HTMLElement | Window | null = null;
let applyingFreeze = false;

function freezeScrollTarget(): HTMLElement | Window | null {
  if (typeof window === 'undefined') return null;
  return scrollRoot ?? window;
}

function onFrozenScroll() {
  if (frozenScrollTop == null || applyingFreeze) return;
  const y = readScrollY();
  if (Math.abs(y - frozenScrollTop) <= 1) return;
  applyingFreeze = true;
  try {
    if (scrollRoot) {
      scrollRoot.scrollTop = frozenScrollTop;
    } else {
      window.scrollTo({ top: frozenScrollTop, left: 0, behavior: 'auto' });
    }
  } finally {
    applyingFreeze = false;
  }
}

function bindFreezeListener() {
  const next = frozenScrollTop == null ? null : freezeScrollTarget();
  if (freezeTarget === next) return;
  freezeTarget?.removeEventListener('scroll', onFrozenScroll);
  freezeTarget = next;
  freezeTarget?.addEventListener('scroll', onFrozenScroll, { passive: true });
}

export function isMainColumnScrollFrozen(): boolean {
  return frozenScrollTop != null;
}

export function freezeMainColumnScrollAt(top: number): void {
  frozenScrollTop = clampScrollTop(top);
  bindFreezeListener();
  onFrozenScroll();
}

export function reapplyMainColumnScrollFreeze(): void {
  onFrozenScroll();
}

export function clearMainColumnScrollFreeze(): void {
  if (frozenScrollTop == null && freezeTarget == null) return;
  frozenScrollTop = null;
  bindFreezeListener();
}

/**
 * The main column is a flex column. Padding on that scroller does not extend
 * scrollHeight in Chromium, so a short tab `loading.tsx` clamps `scrollTop`
 * to 0 and the space cover flashes in. A min-height on the in-flow space
 * column (`[data-space-scroll-hold]`) does extend it. Set the variable before
 * the route commit so the clamp never happens.
 */
const SPACE_SCROLL_HOLD_VAR = '--hypha-space-scroll-hold';
let heldOverflowAnchorEl: HTMLElement | null = null;
let heldOverflowAnchorPrev: string | null = null;

export function holdMainColumnScrollHeight(top: number): void {
  if (typeof document === 'undefined') return;
  const el = scrollRoot;
  const needed =
    clampScrollTop(top) + (el?.clientHeight ?? window.innerHeight) + 2;
  document.documentElement.style.setProperty(
    SPACE_SCROLL_HOLD_VAR,
    `${needed}px`,
  );
  // Flush so the min-height is in effect before the caller writes scrollTop.
  document.querySelector('[data-space-scroll-hold]')?.getBoundingClientRect();
  if (!el) return;
  if (heldOverflowAnchorEl !== el) {
    if (heldOverflowAnchorEl) {
      heldOverflowAnchorEl.style.overflowAnchor = heldOverflowAnchorPrev ?? '';
    }
    heldOverflowAnchorEl = el;
    heldOverflowAnchorPrev = el.style.overflowAnchor;
    el.style.overflowAnchor = 'none';
  }
}

export function releaseMainColumnScrollHeightHold(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.removeProperty(SPACE_SCROLL_HOLD_VAR);
  if (!heldOverflowAnchorEl) return;
  heldOverflowAnchorEl.style.overflowAnchor = heldOverflowAnchorPrev ?? '';
  heldOverflowAnchorEl = null;
  heldOverflowAnchorPrev = null;
}

/**
 * Max scroll the column can hold without the route-change min-height.
 * Measuring clears that min-height for the read; callers that are pinning
 * must reapply the freeze before paint or the browser keeps a clamped top.
 */
export function getMainColumnNaturalMaxScroll(): number {
  if (typeof window === 'undefined') return 0;
  const el = scrollRoot;
  if (!el) {
    return Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
  }
  const hold = document.querySelector<HTMLElement>('[data-space-scroll-hold]');
  if (!hold) return Math.max(0, el.scrollHeight - el.clientHeight);
  const prev = hold.style.minHeight;
  applyingFreeze = true;
  hold.style.minHeight = '0px';
  const natural = el.scrollHeight;
  hold.style.minHeight = prev;
  applyingFreeze = false;
  return Math.max(0, natural - el.clientHeight);
}

export function scrollMainColumnBy(
  deltaY: number,
  behavior: ScrollBehavior = 'auto',
): void {
  if (typeof window === 'undefined') return;
  const current = scrollRoot ? scrollRoot.scrollTop : window.scrollY;
  scrollMainColumnTo(current + deltaY, behavior);
}

export function scrollMainColumnTo(
  top: number,
  behavior: ScrollBehavior = 'auto',
): void {
  if (typeof window === 'undefined') return;
  const next = clampScrollTop(top);
  // `behavior: 'auto'` must be an instant write. `scrollTo({ behavior })` can
  // stay on a CSS smooth-scroll and glide through 0, which opens a gap under
  // the menu and flashes the space cover.
  if (behavior === 'auto') {
    if (scrollRoot) {
      if (Math.abs(scrollRoot.scrollTop - next) > 0.5)
        scrollRoot.scrollTop = next;
      return;
    }
    if (Math.abs(window.scrollY - next) > 0.5) window.scrollTo(0, next);
    return;
  }
  if (scrollRoot) {
    scrollRoot.scrollTo({ top: next, behavior });
    return;
  }
  window.scrollTo({ top: next, behavior });
}

/**
 * Ease-in-out sine. The previous cubic rushed through the middle (about
 * two-thirds of the distance in the middle third of the time) and read as a snap.
 */
function easeSettle(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return (1 - Math.cos(Math.PI * t)) / 2;
}

export type AnimateMainColumnScrollOptions = {
  /**
   * Write each frame through the scroll freeze. A loading skeleton or Next
   * `scrollIntoView` that tries to jump to 0 is pulled back to this frame,
   * never below the menu.
   */
  followFreeze?: boolean;
  /**
   * Remaining distance to the banner, read near the end. A layout shift is
   * eased closed instead of snapped on the last frame.
   */
  readRemainingDelta?: () => number | null;
};

/**
 * Ease the main column by `deltaY` over `durationMs`.
 * Returns a cancel function. Prefer this over `behavior: 'smooth'` when
 * duration must be controlled (browser smooth scroll timing is opaque).
 */
export function animateMainColumnScrollBy(
  deltaY: number,
  durationMs: number,
  onDone?: () => void,
  options?: AnimateMainColumnScrollOptions,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const startY = readScrollY();
  const dest = clampScrollTop(startY + deltaY);
  if (durationMs <= 0 || Math.abs(dest - startY) < 0.5) {
    if (Math.abs(dest - startY) >= 0.5) {
      if (options?.followFreeze) freezeMainColumnScrollAt(dest);
      else scrollMainColumnTo(dest, 'auto');
    }
    onDone?.();
    return () => {};
  }

  let fromY = startY;
  let toY = dest;
  let segmentStart = performance.now();
  let segmentMs = durationMs;
  let raf = 0;
  let cancelled = false;
  let corrected = false;
  let heldFor = dest;

  if (options?.followFreeze) holdMainColumnScrollHeight(dest);

  const write = (y: number) => {
    const next = clampScrollTop(y);
    if (options?.followFreeze) {
      if (next > heldFor + 1) {
        heldFor = next;
        holdMainColumnScrollHeight(next);
      }
      freezeMainColumnScrollAt(next);
      return;
    }
    scrollMainColumnTo(next, 'auto');
  };

  const frame = (now: number) => {
    if (cancelled) return;
    const p = Math.min(1, (now - segmentStart) / segmentMs);
    write(fromY + (toY - fromY) * easeSettle(p));
    if (p < 1) {
      raf = requestAnimationFrame(frame);
      return;
    }
    if (!corrected && options?.readRemainingDelta) {
      const rest = options.readRemainingDelta();
      if (rest != null && Math.abs(rest) > 4) {
        corrected = true;
        fromY = readScrollY();
        toY = clampScrollTop(fromY + rest);
        segmentStart = now;
        segmentMs = Math.min(240, Math.max(120, Math.abs(rest) * 4));
        raf = requestAnimationFrame(frame);
        return;
      }
      if (rest != null && Math.abs(rest) > 0.5) {
        write(readScrollY() + rest);
      }
    }
    onDone?.();
  };

  raf = requestAnimationFrame(frame);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}

export function useMainColumnScrollY(): number {
  return useSyncExternalStore(
    subscribeMainColumnScroll,
    getMainColumnScrollY,
    () => 0,
  );
}

/** Ref-count: freeze main-column scroll while e.g. proposal overlay scrolls its own panel (avoid double rails). */
let overlayScrollLockDepth = 0;
let lockedInsetEl: HTMLElement | null = null;
let lockedInsetPrevOverflow = '';

export function pushMainColumnOverlayScrollLock(): void {
  if (typeof document === 'undefined') return;
  overlayScrollLockDepth += 1;
  if (overlayScrollLockDepth !== 1) return;
  const el = scrollRoot;
  if (!el) return;
  lockedInsetEl = el;
  lockedInsetPrevOverflow = el.style.overflow;
  el.style.overflow = 'hidden';
}

export function popMainColumnOverlayScrollLock(): void {
  if (typeof document === 'undefined') return;
  if (overlayScrollLockDepth === 0) return;
  overlayScrollLockDepth -= 1;
  if (overlayScrollLockDepth !== 0) return;
  const el = lockedInsetEl;
  lockedInsetEl = null;
  if (!el) return;
  el.style.overflow = lockedInsetPrevOverflow;
  lockedInsetPrevOverflow = '';
}
