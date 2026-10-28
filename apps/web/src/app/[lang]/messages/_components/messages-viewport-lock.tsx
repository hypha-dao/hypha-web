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
 * Desktop: channel menu stays in page flow (no left scrollbar). Only the
 * conversation list gets a fixed frame — at least as tall as the menu, and
 * tall enough to fill the visible column.
 * Phone: pin the whole screen so the menu or list can scroll under the tabs.
 */
export function MessagesViewportLock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollMainColumnTo(0);
    let observedScroll: HTMLElement | null = null;
    let observedFilters: HTMLElement | null = null;
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
      const filters = root.querySelector('[data-messages-filters]');
      observedList = watch(
        list instanceof HTMLElement ? list : null,
        observedList,
      );
      observedFilters = watch(
        filters instanceof HTMLElement ? filters : null,
        observedFilters,
      );
      const scrollRect = scrollEl?.getBoundingClientRect();
      const viewportBottom = window.visualViewport
        ? window.visualViewport.offsetTop + window.visualViewport.height
        : window.innerHeight;
      const tabOffset = mobileTabOffset();
      const footerOffset = desktopFooterOffset();
      const desktopInbox = window.matchMedia(DESKTOP_INBOX).matches;

      if (desktopInbox && list instanceof HTMLElement) {
        root.style.height = '';
        root.style.maxHeight = '';
        const available = messagesFrameHeight({
          frameTop: list.getBoundingClientRect().top,
          scrollBottom: scrollRect?.bottom ?? viewportBottom,
          viewportBottom,
          tabOffset,
          footerOffset,
        });
        const leftHeight =
          filters instanceof HTMLElement
            ? filters.getBoundingClientRect().height
            : 0;
        list.style.height = `${messagesListFrameHeight({
          available,
          leftHeight,
        })}px`;
        list.style.maxHeight = '';
        return;
      }

      clearListFrameHeight(root);
      const height = messagesFrameHeight({
        frameTop: root.getBoundingClientRect().top,
        scrollBottom: scrollRect?.bottom ?? viewportBottom,
        viewportBottom,
        tabOffset,
        footerOffset,
      });
      root.style.height = `${Math.max(height, 160)}px`;
      root.style.maxHeight = '';
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
      className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden lg:overflow-visible"
    >
      {children}
    </div>
  );
}
