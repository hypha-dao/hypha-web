'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Coherence } from '@hypha-platform/core/client';
import {
  pickSignalDeepLinkTarget,
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
  /** Empty means every priority is visible. */
  priorityFilters?: readonly string[];
  /** Empty means every type is visible. */
  typeFilters?: readonly string[];
  /** When set, skip re-opening chat / scroll if the user is already on this signal. */
  activeCoherenceSlug?: string | null;
  onOpenSignalChat?: (signal: Coherence) => void;
  onRevealArchivedSignal?: () => void;
  onClearPriorityFilter?: () => void;
  onRefreshSignals?: () => void | Promise<void>;
};

/**
 * When `?signal=<slug>` is present, scroll the matching card into view and
 * open its chat. A new signal in the URL replaces the one already open.
 * A chat that just changed still wins over a URL that has not caught up.
 */
export function useCoherenceSignalDeepLink({
  signals,
  isLoading,
  humanChatEnabled,
  humanChatOpen = false,
  hideArchived,
  priorityFilters = [],
  typeFilters = [],
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
  const previousChatSlugRef = React.useRef<string | null | undefined>(
    undefined,
  );
  const previousUrlSlugRef = React.useRef<string | null | undefined>(undefined);
  const previousChoiceRef = React.useRef<string | null>(null);

  const searchParamSlug = searchParams.get('signal')?.trim() || null;
  const urlSlug =
    typeof window !== 'undefined'
      ? readLiveSignalSlugFromUrl()
      : searchParamSlug;
  const chatSlug = activeCoherenceSlug?.trim() || null;
  const targetSlug = pickSignalDeepLinkTarget({
    humanChatEnabled,
    chatSlug,
    urlSlug,
    previousChatSlug: previousChatSlugRef.current,
    previousUrlSlug: previousUrlSlugRef.current,
    previousChoice: previousChoiceRef.current,
  });
  previousChatSlugRef.current = chatSlug;
  previousUrlSlugRef.current = urlSlug;
  previousChoiceRef.current = targetSlug;

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

    if (
      (priorityFilters.length > 0 &&
        !priorityFilters.includes(signal.priority ?? '')) ||
      (typeFilters.length > 0 && !typeFilters.includes(signal.type))
    ) {
      onClearPriorityFilter?.();
      return;
    }

    const chatSlug = activeCoherenceSlug?.trim() ?? null;
    const alreadyViewingSignal =
      chatSlug === targetSlug || openedChatForSlugRef.current === targetSlug;

    if (onOpenSignalChat && !alreadyViewingSignal) {
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
    priorityFilters,
    typeFilters,
    signals,
    targetSlug,
  ]);
}
