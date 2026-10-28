'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import {
  getMainColumnScrollElement,
  scrollMainColumnTo,
  subscribeMainColumnScroll,
} from '@hypha-platform/epics';

import {
  messagesFrameHeight,
  messagesListFrameHeight,
} from './messages-frame-height';

export {
  messagesFrameHeight,
  messagesListFrameHeight,
} from './messages-frame-height';

const DESKTOP_MENU = '(min-width: 80rem)';
/** Side-by-side channel menu + conversation list (Tailwind `lg`). */
const DESKTOP_INBOX = '(min-width: 64rem)';

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

function clearListFrameHeight(root: HTMLElement) {
  const list = root.querySelector('[data-messages-list-frame]');
  if (list instanceof HTMLElement) {
    list.style.height = '';
    list.style.maxHeight = '';
  }
}

/**
 * Only the conversation list scrolls. The channel menu stays put in the
 * pinned screen, and the site footer stays visible under that frame.
 */
export function MessagesViewportLock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollMainColumnTo(0);
    let observedScroll: HTMLElement | null = null;
    let observedList: HTMLElement | null = null;

    const watch = (node: HTMLElement | null, previous: HTMLElement | null) => {
      if (node === previous) return node;
      if (previous) observer.unobserve(previous);
      if (node) observer.observe(node);
      return node;
    };

    const fit = () => {
      const root = ref.current;
      if (!root) return;
      const scrollEl = getMainColumnScrollElement();
      observedScroll = watch(scrollEl, observedScroll);
      const list = root.querySelector('[data-messages-list-frame]');
      observedList = watch(
        list instanceof HTMLElement ? list : null,
        observedList,
      );
      const scrollRect = scrollEl?.getBoundingClientRect();
      const viewportBottom = window.visualViewport
        ? window.visualViewport.offsetTop + window.visualViewport.height
        : window.innerHeight;
      const tabOffset = mobileTabOffset();
      const footerOffset = desktopFooterOffset();
      const desktopInbox = window.matchMedia(DESKTOP_INBOX).matches;

      const rootAvailable = messagesFrameHeight({
        frameTop: root.getBoundingClientRect().top,
        scrollBottom: scrollRect?.bottom ?? viewportBottom,
        viewportBottom,
        tabOffset,
        footerOffset,
      });
      // Pin the whole messages screen above the footer so the page does not
      // grow past it. Only the right list scrolls inside that pin.
      root.style.height = `${Math.max(rootAvailable, 160)}px`;
      root.style.maxHeight = '';

      if (desktopInbox && list instanceof HTMLElement) {
        const listAvailable = messagesFrameHeight({
          frameTop: list.getBoundingClientRect().top,
          scrollBottom: scrollRect?.bottom ?? viewportBottom,
          viewportBottom,
          tabOffset,
          footerOffset,
        });
        list.style.height = `${messagesListFrameHeight({
          available: listAvailable,
        })}px`;
        list.style.maxHeight = '';
        return;
      }

      clearListFrameHeight(root);
    };

    const observer = new ResizeObserver(fit);
    fit();
    observer.observe(document.documentElement);
    const footer = document.querySelector('footer');
    if (footer) observer.observe(footer);
    const root = ref.current;
    if (root) observer.observe(root);
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
        clearListFrameHeight(frame);
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
