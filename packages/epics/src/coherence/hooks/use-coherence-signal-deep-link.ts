'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Coherence } from '@hypha-platform/core/client';
import {
  readLiveSignalSlugFromUrl,
  scrollToSignalCardWithRetry,
} from '../lib/signal-deep-link-dom';

type UseCoherenceSignalDeepLinkOptions = {
  signals: Coherence[] | undefined;
  isLoading: boolean;
  humanChatEnabled: boolean;
  /** When human chat is enabled, skip scroll/actions after the user closed the panel. */
  humanChatOpen?: boolean;
  hideArchived: boolean;
  priorityFilter: 'all' | 'critical' | 'high' | 'medium' | 'low';
  /** When set, skip re-opening chat / scroll if the user is already on this signal. */
  activeCoherenceSlug?: string | null;
  onOpenSignalChat?: (signal: Coherence) => void;
  onRevealArchivedSignal?: () => void;
  onClearPriorityFilter?: () => void;
  onRefreshSignals?: () => void | Promise<void>;
};

/**
 * When `?signal=<slug>` is present on a coherence route, scroll the matching
 * card into view and optionally open its chat thread.
 *
 * Chat opening for human-chat spaces is owned by `HumanRightPanel`; this hook
 * only scrolls/highlights once the thread is already active or the URL is a
 * genuine deep link (live query param, not stale `useSearchParams()`).
 */
export function useCoherenceSignalDeepLink({
  signals,
  isLoading,
  humanChatEnabled,
  humanChatOpen = false,
  hideArchived,
  priorityFilter,
  activeCoherenceSlug,
  onOpenSignalChat,
  onRevealArchivedSignal,
  onClearPriorityFilter,
  onRefreshSignals,
}: UseCoherenceSignalDeepLinkOptions): void {
  const searchParams = useSearchParams();
  const openedChatForSlugRef = React.useRef<string | null>(null);
  const refreshAttemptForSlugRef = React.useRef<string | null>(null);
  const scrolledForSlugRef = React.useRef<string | null>(null);
  const lastLiveSignalSlugRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const signalSlug = readLiveSignalSlugFromUrl();
    if (lastLiveSignalSlugRef.current !== signalSlug) {
      openedChatForSlugRef.current = null;
      refreshAttemptForSlugRef.current = null;
      scrolledForSlugRef.current = null;
      lastLiveSignalSlugRef.current = signalSlug;
    }
  }, [searchParams]);

  React.useEffect(() => {
    const signalSlug = readLiveSignalSlugFromUrl();
    if (!signalSlug || isLoading) return;

    if (humanChatEnabled && !humanChatOpen && !activeCoherenceSlug?.trim()) {
      return;
    }

    const signal = (signals ?? []).find(
      (item) => item.slug?.trim() === signalSlug,
    );
    if (!signal) {
      if (
        onRefreshSignals &&
        signals !== undefined &&
        refreshAttemptForSlugRef.current !== signalSlug
      ) {
        refreshAttemptForSlugRef.current = signalSlug;
        void onRefreshSignals();
      }
      return;
    }

    if (signal.archived && hideArchived) {
      onRevealArchivedSignal?.();
      return;
    }

    if (priorityFilter !== 'all' && signal.priority !== priorityFilter) {
      onClearPriorityFilter?.();
      return;
    }

    const alreadyViewingSignal =
      activeCoherenceSlug?.trim() === signalSlug ||
      openedChatForSlugRef.current === signalSlug;

    if (!humanChatEnabled && onOpenSignalChat && !alreadyViewingSignal) {
      openedChatForSlugRef.current = signalSlug;
      onOpenSignalChat(signal);
    } else if (alreadyViewingSignal) {
      openedChatForSlugRef.current = signalSlug;
    }

    if (scrolledForSlugRef.current === signalSlug || alreadyViewingSignal) {
      scrolledForSlugRef.current = signalSlug;
      return;
    }
    return scrollToSignalCardWithRetry(signalSlug, {
      onFound: () => {
        scrolledForSlugRef.current = signalSlug;
      },
    });
  }, [
    activeCoherenceSlug,
    hideArchived,
    humanChatEnabled,
    humanChatOpen,
    isLoading,
    onClearPriorityFilter,
    onOpenSignalChat,
    onRefreshSignals,
    onRevealArchivedSignal,
    priorityFilter,
    searchParams,
    signals,
  ]);
}
