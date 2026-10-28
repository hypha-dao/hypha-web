'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import {
  getMainColumnScrollElement,
  scrollMainColumnTo,
  subscribeMainColumnScroll,
} from '@hypha-platform/epics';

import { messagesFrameHeight } from './messages-frame-height';

export { messagesFrameHeight } from './messages-frame-height';

const DESKTOP_MENU = '(min-width: 80rem)';

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

/** Site footer is a sibling under the page; pin must leave room or it vanishes. */
function desktopFooterOffset(): number {
  if (!window.matchMedia(DESKTOP_MENU).matches) return 0;
  const footer = document.querySelector('footer');
  if (!footer) return 0;
  const height = footer.getBoundingClientRect().height;
  return Number.isFinite(height) ? Math.ceil(height) : 0;
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
    let observed: HTMLElement | null = null;

    const fit = () => {
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
        footerOffset: desktopFooterOffset(),
      });
      // Cap the list so it can scroll inside, but do NOT freeze the main
      // column — the page must still move (title spacing, footer). A hard
      // overflow lock made Share messages feel stuck under the title.
      frame.style.maxHeight = `${Math.max(height, 160)}px`;
      frame.style.height = '';
    };

    const observer = new ResizeObserver(fit);
    fit();
    observer.observe(document.documentElement);
    const footer = document.querySelector('footer');
    if (footer) observer.observe(footer);
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
      if (frame) {
        frame.style.height = '';
        frame.style.maxHeight = '';
      }
    };
  }, []);

  return (
    <div
      ref={ref}
      className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
    >
      {children}
    </div>
  );
}
