'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Coherence } from '@hypha-platform/core/client';
import { scrollToSignalCardWithRetry } from '../lib/signal-deep-link-dom';

type UseCoherenceSignalDeepLinkOptions = {
  signals: Coherence[] | undefined;
  isLoading: boolean;
  humanChatEnabled: boolean;
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
 */
export function useCoherenceSignalDeepLink({
  signals,
  isLoading,
  humanChatEnabled,
  hideArchived,
  priorityFilter,
  activeCoherenceSlug,
  onOpenSignalChat,
  onRevealArchivedSignal,
  onClearPriorityFilter,
  onRefreshSignals,
}: UseCoherenceSignalDeepLinkOptions): void {
  const searchParams = useSearchParams();
  const signalSlug = searchParams.get('signal')?.trim() ?? null;
  const openedChatForSlugRef = React.useRef<string | null>(null);
  const refreshAttemptForSlugRef = React.useRef<string | null>(null);
  const scrolledForSlugRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    openedChatForSlugRef.current = null;
    refreshAttemptForSlugRef.current = null;
    scrolledForSlugRef.current = null;
  }, [signalSlug]);

  React.useEffect(() => {
    if (!signalSlug || isLoading) return;

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

    if (
      humanChatEnabled &&
      onOpenSignalChat &&
      !alreadyViewingSignal
    ) {
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
    hideArchived,
    humanChatEnabled,
    isLoading,
    activeCoherenceSlug,
    onClearPriorityFilter,
    onOpenSignalChat,
    onRefreshSignals,
    onRevealArchivedSignal,
    priorityFilter,
    signalSlug,
    signals,
  ]);
}
