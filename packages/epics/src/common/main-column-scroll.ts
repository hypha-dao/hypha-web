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

export function useMainColumnScrollY(): number {
  return useSyncExternalStore(
    subscribeMainColumnScroll,
    getMainColumnScrollY,
    () => 0,
  );
}
