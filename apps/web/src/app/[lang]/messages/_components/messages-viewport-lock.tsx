'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { messagesListFrameHeight } from './messages-frame-height';

export { messagesListFrameHeight } from './messages-frame-height';

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
}

/**
 * Page still scrolls. The right conversation list is capped to the viewport
 * and sticky, so it scrolls on its own and loads more without growing the
 * page. Footer stays below the fold in normal page flow.
 */
export function MessagesViewportLock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fit = () => {
      const root = ref.current;
      if (!root) return;
      const list = root.querySelector('[data-messages-list-frame]');
      const desktopInbox = window.matchMedia(DESKTOP_INBOX).matches;
      const viewportBottom = window.visualViewport
        ? window.visualViewport.offsetTop + window.visualViewport.height
        : window.innerHeight;

      if (desktopInbox && list instanceof HTMLElement) {
        const height = messagesListFrameHeight({
          viewportBottom,
          menuOffset: menuOffset(),
          tabOffset: mobileTabOffset(),
        });
        list.style.height = `${height}px`;
        list.style.maxHeight = `${height}px`;
        return;
      }

      clearListFrameHeight(root);
    };

    const observer = new ResizeObserver(fit);
    fit();
    observer.observe(document.documentElement);
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
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
