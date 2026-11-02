'use client';

import React from 'react';
import {
  SIGNAL_PROVISIONING_NOTICE_EVENT,
  SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY,
} from '../constants';

const AUTO_DISMISS_MS = 8000;

/**
 * Lines the create flow left in sessionStorage (chat, upvote or tagging
 * problems after a signal was created). Cleared on read, hidden after 8s.
 */
export function useSignalProvisioningNotice(): string[] {
  const [lines, setLines] = React.useState<string[]>([]);

  const read = React.useCallback(() => {
    const raw = sessionStorage.getItem(SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY);
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const next = parsed.filter(
        (line): line is string =>
          typeof line === 'string' && line.trim().length > 0,
      );
      if (next.length > 0) setLines(next);
    } catch (error) {
      console.warn('Failed to parse signal provisioning notice:', error);
    }
  }, []);

  React.useEffect(() => {
    read();
    window.addEventListener(SIGNAL_PROVISIONING_NOTICE_EVENT, read);
    return () => {
      window.removeEventListener(SIGNAL_PROVISIONING_NOTICE_EVENT, read);
    };
  }, [read]);

  React.useEffect(() => {
    if (lines.length === 0) return;
    const timer = window.setTimeout(() => setLines([]), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [lines]);

  return lines;
}
