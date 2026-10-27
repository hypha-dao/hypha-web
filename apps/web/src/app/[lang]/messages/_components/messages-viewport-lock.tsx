'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import {
  getMainColumnScrollElement,
  popMainColumnOverlayScrollLock,
  pushMainColumnOverlayScrollLock,
  scrollMainColumnTo,
} from '@hypha-platform/epics';

const DESKTOP_MENU = '(min-width: 80rem)';

/** Height of the messages frame: the visible column under the menu, above the phone tab bar. */
export function messagesFrameHeight(input: {
  frameTop: number;
  scrollBottom: number;
  tabOffset: number;
}): number {
  const next = Math.floor(
    input.scrollBottom - input.frameTop - input.tabOffset,
  );
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
 * The site menu lives inside the scrolling column. A viewport-tall inbox
 * inside that column is taller than the screen, so the page scrolls both
 * the channel menu and the conversation list. This pins the inbox to the
 * space that is actually visible and lets only the list scroll.
 */
export function MessagesViewportLock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollMainColumnTo(0);
    pushMainColumnOverlayScrollLock();

    const fit = () => {
      const frame = ref.current;
      if (!frame) return;
      const scrollEl = getMainColumnScrollElement();
      const scrollBottom = scrollEl
        ? scrollEl.getBoundingClientRect().bottom
        : window.innerHeight;
      const height = messagesFrameHeight({
        frameTop: frame.getBoundingClientRect().top,
        scrollBottom,
        tabOffset: mobileTabOffset(),
      });
      if (height < 160) return;
      frame.style.height = `${height}px`;
    };

    fit();
    const observer = new ResizeObserver(fit);
    const scrollEl = getMainColumnScrollElement();
    if (scrollEl) observer.observe(scrollEl);
    observer.observe(document.documentElement);
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      const frame = ref.current;
      if (frame) frame.style.height = '';
      popMainColumnOverlayScrollLock();
    };
  }, []);

  return (
    <div ref={ref} className="flex w-full min-w-0 flex-col overflow-hidden">
      {children}
    </div>
  );
}
