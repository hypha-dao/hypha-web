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

function resolveDeepLinkTargetSlug(
  humanChatEnabled: boolean,
  activeCoherenceSlug: string | null | undefined,
): string | null {
  const chatSlug = activeCoherenceSlug?.trim() ?? null;
  if (humanChatEnabled && chatSlug) {
    return chatSlug;
  }
  return readLiveSignalSlugFromUrl();
}

/**
 * When `?signal=<slug>` is present on a coherence route, scroll the matching
 * card into view and optionally open its chat thread.
 *
 * Chat opening for human-chat spaces is owned by `HumanRightPanel`; this hook
 * only scrolls/highlights. When a coherence chat is active, the live chat slug
 * wins over a lagging `?signal=` param so selection does not flash between cards.
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
  const lastTargetSlugRef = React.useRef<string | null>(null);

  const targetSlug = React.useMemo(
    () => resolveDeepLinkTargetSlug(humanChatEnabled, activeCoherenceSlug),
    [activeCoherenceSlug, humanChatEnabled, searchParams],
  );

  React.useEffect(() => {
    if (lastTargetSlugRef.current !== targetSlug) {
      openedChatForSlugRef.current = null;
      refreshAttemptForSlugRef.current = null;
      scrolledForSlugRef.current = null;
      lastTargetSlugRef.current = targetSlug;
    }
  }, [targetSlug]);

  React.useEffect(() => {
    if (!targetSlug || isLoading) return;

    if (humanChatEnabled && !humanChatOpen && !activeCoherenceSlug?.trim()) {
      return;
    }

    const signal = (signals ?? []).find(
      (item) => item.slug?.trim() === targetSlug,
    );
    if (!signal) {
      if (
        onRefreshSignals &&
        signals !== undefined &&
        refreshAttemptForSlugRef.current !== targetSlug
      ) {
        refreshAttemptForSlugRef.current = targetSlug;
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

    const chatSlug = activeCoherenceSlug?.trim() ?? null;
    const alreadyViewingSignal =
      chatSlug === targetSlug || openedChatForSlugRef.current === targetSlug;

    if (!humanChatEnabled && onOpenSignalChat && !alreadyViewingSignal) {
      openedChatForSlugRef.current = targetSlug;
      onOpenSignalChat(signal);
    } else if (alreadyViewingSignal) {
      openedChatForSlugRef.current = targetSlug;
    }

    // Chat-driven selection: the user already clicked the card — ring only, no scroll.
    if (humanChatEnabled && humanChatOpen && chatSlug === targetSlug) {
      scrolledForSlugRef.current = targetSlug;
      return;
    }

    if (scrolledForSlugRef.current === targetSlug) {
      return;
    }

    return scrollToSignalCardWithRetry(targetSlug, {
      onFound: () => {
        scrolledForSlugRef.current = targetSlug;
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
    signals,
    targetSlug,
  ]);
}
