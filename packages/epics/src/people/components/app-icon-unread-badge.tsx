'use client';

import { useEffect } from 'react';

import { useMessagesScreenCount } from './my-connections';

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * Syncs the Messages unread total onto the installed Home Screen / PWA icon
 * (Badging API). On iOS 16.4+ the badge only appears after the user grants
 * notification permission for the Home Screen web app — same gate as WhatsApp
 * / Discord native badges.
 */
export function AppIconUnreadBadge() {
  const unreadCount = useMessagesScreenCount();

  useEffect(() => {
    const nav = navigator as BadgeNavigator;
    if (typeof nav.setAppBadge !== 'function') return;

    let cancelled = false;
    void (async () => {
      try {
        if (unreadCount > 0) {
          await nav.setAppBadge?.(unreadCount);
        } else {
          await nav.clearAppBadge?.();
        }
      } catch {
        // Unsupported, denied, or transient — ignore.
      }
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [unreadCount]);

  return null;
}
