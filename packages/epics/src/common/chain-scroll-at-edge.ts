'use client';

import { useCallback, useEffect, useRef, type RefCallback } from 'react';

import { scrollMainColumnBy } from './main-column-scroll';

/**
 * Leftover wheel/touch delta once an inner list is at its top or bottom.
 * Null while the list can still move — the page must stay put.
 * A list that cannot scroll forwards the whole delta.
 */
export function boundaryScrollLeftover(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  deltaY: number,
): number | null {
  if (!Number.isFinite(deltaY) || deltaY === 0) return null;
  const max = Math.max(0, scrollHeight - clientHeight);
  if (max <= 1) return deltaY;
  const next = scrollTop + deltaY;
  if (deltaY < 0 && next < 0) return next;
  if (deltaY > 0 && next > max) return next - max;
  return null;
}

function isInnerScrollport(el: HTMLElement): boolean {
  const overflowY = getComputedStyle(el).overflowY;
  return overflowY === 'auto' || overflowY === 'scroll';
}

/** At the edge of this scroller, move the main column. No-op in the middle. */
export function attachChainScrollAtEdge(el: HTMLElement): () => void {
  const forward = (deltaY: number) => {
    if (!isInnerScrollport(el)) return;
    const leftover = boundaryScrollLeftover(
      el.scrollTop,
      el.clientHeight,
      el.scrollHeight,
      deltaY,
    );
    if (leftover == null) return;
    scrollMainColumnBy(leftover);
  };

  const onWheel = (event: WheelEvent) => {
    forward(event.deltaY);
  };

  let lastY = 0;
  const onTouchStart = (event: TouchEvent) => {
    lastY = event.touches[0]?.clientY ?? 0;
  };
  const onTouchMove = (event: TouchEvent) => {
    const y = event.touches[0]?.clientY;
    if (y == null) return;
    const delta = lastY - y;
    lastY = y;
    forward(delta);
  };

  el.addEventListener('wheel', onWheel, { passive: true });
  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchmove', onTouchMove, { passive: true });
  return () => {
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
  };
}

/** Callback ref: chain only while this node is an overflow scrollport. */
export function useChainScrollAtEdge(): RefCallback<HTMLElement> {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      cleanup.current?.();
      cleanup.current = null;
    },
    [],
  );
  return useCallback((node: HTMLElement | null) => {
    cleanup.current?.();
    cleanup.current = node ? attachChainScrollAtEdge(node) : null;
  }, []);
}
