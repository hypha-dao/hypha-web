'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import {
  getMainColumnScrollElement,
  popMainColumnOverlayScrollLock,
  pushMainColumnOverlayScrollLock,
  scrollMainColumnTo,
  subscribeMainColumnScroll,
} from '@hypha-platform/epics';

const DESKTOP_MENU = '(min-width: 80rem)';

/** Height of the messages frame: the visible column under the menu, above the phone tab bar. */
export function messagesFrameHeight(input: {
  frameTop: number;
  scrollBottom: number;
  viewportBottom: number;
  tabOffset: number;
}): number {
  const visibleBottom = Math.min(input.scrollBottom, input.viewportBottom);
  const next = Math.floor(visibleBottom - input.frameTop - input.tabOffset);
  return Number.isFinite(next) ? Math.max(0, next) : 0;
}

function mobileTabOffset(): number {
  if (window.matchMedia(DESKTOP_MENU).matches) return 0;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--mobile-tab-offset')
    .trim();
  if (!raw) return 96;
  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.height = raw;
  probe.style.visibility = 'hidden';
  document.body.appendChild(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return height || 96;
}

/**
 * The site menu lives inside the scrolling column. A content-sized inbox
 * grows past the screen, so wheel events over an unbounded
 * `overflow-y-auto` list neither scroll the page nor the list. Pin the
 * frame to the visible column and let only the conversation list scroll.
 */
export function MessagesViewportLock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollMainColumnTo(0);
    let locked = false;
    let observed: HTMLElement | null = null;

    const armLock = () => {
      if (locked || !getMainColumnScrollElement()) return;
      pushMainColumnOverlayScrollLock();
      locked = true;
    };

    const fit = () => {
      armLock();
      const frame = ref.current;
      if (!frame) return;
      const scrollEl = getMainColumnScrollElement();
      if (scrollEl && scrollEl !== observed) {
        if (observed) observer.unobserve(observed);
        observer.observe(scrollEl);
        observed = scrollEl;
      }
      const scrollRect = scrollEl?.getBoundingClientRect();
      const viewportBottom = window.visualViewport
        ? window.visualViewport.offsetTop + window.visualViewport.height
        : window.innerHeight;
      const height = messagesFrameHeight({
        frameTop: frame.getBoundingClientRect().top,
        scrollBottom: scrollRect?.bottom ?? viewportBottom,
        viewportBottom,
        tabOffset: mobileTabOffset(),
      });
      // Always pin a height. Skipping left the frame content-sized while the
      // main column was overflow-locked, so neither the page nor the list
      // could scroll and the inbox looked clipped.
      frame.style.height = `${Math.max(height, 160)}px`;
    };

    const observer = new ResizeObserver(fit);
    fit();
    observer.observe(document.documentElement);
    const stopWatchingScrollRoot = subscribeMainColumnScroll(fit);
    window.addEventListener('resize', fit);
    window.addEventListener('scroll', fit, { passive: true });
    window.visualViewport?.addEventListener('resize', fit);

    return () => {
      stopWatchingScrollRoot();
      observer.disconnect();
      window.removeEventListener('resize', fit);
      window.removeEventListener('scroll', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      const frame = ref.current;
      if (frame) frame.style.height = '';
      if (locked) popMainColumnOverlayScrollLock();
    };
  }, []);

  return (
    <div
      ref={ref}
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
    >
      {children}
    </div>
  );
}
