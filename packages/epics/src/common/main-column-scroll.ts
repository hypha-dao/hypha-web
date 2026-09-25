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
  if (scrollRoot) {
    scrollRoot.scrollTo({ top: next, behavior });
    return;
  }
  window.scrollTo({ top: next, behavior });
}

/**
 * Ease the main column by `deltaY` over `durationMs` (cubic in-out).
 * Returns a cancel function. Prefer this over `behavior: 'smooth'` when
 * duration must be controlled (browser smooth scroll timing is opaque).
 */
export function animateMainColumnScrollBy(
  deltaY: number,
  durationMs: number,
  onDone?: () => void,
): () => void {
  if (
    typeof window === 'undefined' ||
    durationMs <= 0 ||
    Math.abs(deltaY) < 0.5
  ) {
    if (Math.abs(deltaY) >= 0.5) scrollMainColumnBy(deltaY, 'auto');
    onDone?.();
    return () => {};
  }

  const startY = readScrollY();
  const t0 = performance.now();
  let raf = 0;
  let cancelled = false;

  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const frame = (now: number) => {
    if (cancelled) return;
    const p = Math.min(1, (now - t0) / durationMs);
    scrollMainColumnTo(startY + deltaY * easeInOutCubic(p), 'auto');
    if (p < 1) {
      raf = requestAnimationFrame(frame);
      return;
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
