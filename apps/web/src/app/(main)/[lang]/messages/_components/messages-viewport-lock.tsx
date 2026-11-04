'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import {
  messagesChannelMenuOverflows,
  messagesListFrameHeight,
  messagesVisibleViewportHeight,
} from './messages-frame-height';

export {
  messagesChannelMenuOverflows,
  messagesListFrameHeight,
  messagesVisibleViewportHeight,
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

function menuOffset(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--menu-top-height')
    .trim();
  if (!raw) return 72;
  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.height = raw;
  probe.style.visibility = 'hidden';
  document.body.appendChild(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return height || 72;
}

function clearListFrameHeight(root: HTMLElement) {
  const list = root.querySelector('[data-messages-list-frame]');
  if (list instanceof HTMLElement) {
    list.style.height = '';
    list.style.maxHeight = '';
  }
  const filters = root.querySelector('[data-messages-filters]');
  if (filters instanceof HTMLElement) {
    filters.style.maxHeight = '';
    filters.style.minHeight = '';
    filters.style.overflowY = '';
    filters.style.overscrollBehavior = '';
  }
}

/**
 * Page still scrolls. The conversation list and the channel menu both stay
 * under the top bar. The list scrolls on its own. The menu scrolls on its
 * own only when it is taller than that same cap, so the unread counts stay
 * on screen. Footer stays below the fold in normal page flow.
 */
export function MessagesViewportLock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fit = () => {
      const root = ref.current;
      if (!root) return;
      const list = root.querySelector('[data-messages-list-frame]');
      const desktopInbox = window.matchMedia(DESKTOP_INBOX).matches;
      const viewportBottom = messagesVisibleViewportHeight({
        innerHeight: window.innerHeight,
        visualHeight: window.visualViewport?.height,
        hidden: document.hidden,
      });
      // Keep the last good cap while the tab is hidden or the window
      // reports a collapsed height. Clearing it here is what left the
      // menu behind after inactivity.
      if (viewportBottom == null) return;

      if (desktopInbox && list instanceof HTMLElement) {
        const height = messagesListFrameHeight({
          viewportBottom,
          menuOffset: menuOffset(),
          tabOffset: mobileTabOffset(),
        });
        list.style.height = `${height}px`;
        list.style.maxHeight = `${height}px`;
        const filters = root.querySelector('[data-messages-filters]');
        if (filters instanceof HTMLElement) {
          // Measure the menu itself. The frame's scrollHeight collapses
          // once max-height is applied, which would hide a tall menu's
          // overflow and clip the unread counts.
          const menu =
            filters.querySelector('nav') ?? filters.firstElementChild;
          const contentHeight =
            menu instanceof HTMLElement
              ? menu.offsetHeight
              : filters.scrollHeight;
          // Same cap as the list. A shorter menu stays in the page scroll.
          // A taller one scrolls inside the cap so its counts cannot be
          // pushed off screen the way an inflated list used to do.
          filters.style.maxHeight = `${height}px`;
          filters.style.minHeight = '0';
          const overflows = messagesChannelMenuOverflows(contentHeight, height);
          filters.style.overflowY = overflows ? 'auto' : '';
          filters.style.overscrollBehavior = overflows ? 'contain' : '';
        }
        return;
      }

      clearListFrameHeight(root);
    };

    const onVisible = () => {
      if (!document.hidden) fit();
    };
    const observer = new ResizeObserver(fit);
    fit();
    observer.observe(document.documentElement);
    window.addEventListener('resize', fit);
    window.addEventListener('focus', fit);
    window.addEventListener('pageshow', fit);
    document.addEventListener('visibilitychange', onVisible);
    window.visualViewport?.addEventListener('resize', fit);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
      window.removeEventListener('focus', fit);
      window.removeEventListener('pageshow', fit);
      document.removeEventListener('visibilitychange', onVisible);
      window.visualViewport?.removeEventListener('resize', fit);
      const frame = ref.current;
      if (frame) clearListFrameHeight(frame);
    };
  }, []);

  return (
    <div ref={ref} className="w-full min-w-0">
      {children}
    </div>
  );
}
