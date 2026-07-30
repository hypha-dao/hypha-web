'use client';

import type { ReactNode } from 'react';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { CountBadge, formatCountBadgeLabel } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

export type ChatPanelTab = 'chat' | 'members' | 'mentions';

type HumanChatPanelTabsProps = {
  activeTab: ChatPanelTab;
  onTabChange: (tab: ChatPanelTab) => void;
  /** Unread @mention (highlight) count for the Chat tab badge. */
  chatMentionCount?: number;
  chatMentionCountCapped?: boolean;
  /** Same count, shown on the Mentions tab when non-zero. */
  mentionTabBadgeCount?: number;
  mentionTabBadgeCapped?: boolean;
  /** e.g. voice / video / search (space call controls); end of the tab row (right column). */
  tabRowEnd?: ReactNode;
};

export function HumanChatPanelTabs({
  activeTab,
  onTabChange,
  chatMentionCount = 0,
  chatMentionCountCapped = false,
  mentionTabBadgeCount = 0,
  mentionTabBadgeCapped = false,
  tabRowEnd,
}: HumanChatPanelTabsProps) {
  const t = useTranslations('HumanChatPanel');
  const tabRailScrollRef = useRef<HTMLDivElement | null>(null);

  /** Keep the active tab fully visible inside the horizontally scrollable rail (narrow panels / many tabs). */
  const scrollTabIntoRailIfClipped = useCallback((tabKey: ChatPanelTab) => {
    const el = document.getElementById(`chat-tab-${tabKey}`);
    const rail = tabRailScrollRef.current;
    if (!el || !rail) return;
    const elRect = el.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const pad = 2;
    if (
      elRect.left < railRect.left + pad ||
      elRect.right > railRect.right - pad
    ) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, []);

  const chatBadgeLabel = formatCountBadgeLabel(
    chatMentionCount,
    chatMentionCountCapped,
  );

  const mentionBadgeLabel = formatCountBadgeLabel(
    mentionTabBadgeCount,
    mentionTabBadgeCapped,
  );

  const tabs: { key: ChatPanelTab; label: string }[] = [
    { key: 'chat', label: t('tabChat') },
    { key: 'members', label: t('tabMembers') },
    { key: 'mentions', label: t('tabMentions') },
  ];

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1;
    }
    if (nextIndex !== null) {
      const nextTab = tabs[nextIndex];
      if (!nextTab) return;
      e.preventDefault();
      onTabChange(nextTab.key);
      document.getElementById(`chat-tab-${nextTab.key}`)?.focus();
    }
  };

  const hasEndCluster = Boolean(tabRowEnd);

  useLayoutEffect(() => {
    scrollTabIntoRailIfClipped(activeTab);
  }, [activeTab, scrollTabIntoRailIfClipped]);

  return (
    <div
      className={cn(
        'relative w-full min-w-0 border-b border-border/70 bg-transparent px-4 py-1.5',
        'min-h-[var(--secondary-chrome-actions-row-height,52px)]',
        /* §3.1.1: tab column scrolls; call + settings column is `auto` and does not shrink. */
        'grid w-full min-w-0 items-center',
        hasEndCluster
          ? 'grid-cols-[minmax(0,1fr)_auto] gap-x-1.5'
          : 'grid-cols-1',
      )}
    >
      {/*
        Scroll the rail, not the tab buttons: outer min-w-0 + overflow; inner
        inline-flex w-max so each tab keeps natural width (no one-letter clip).
        role=tablist is on the inner so it still only contains role=tab children.
      */}
      <div
        ref={tabRailScrollRef}
        className={cn(
          'min-w-0 max-w-full self-stretch',
          'overflow-x-auto overflow-y-hidden overscroll-x-contain',
          'touch-pan-x [scrollbar-gutter:stable] [scrollbar-width:thin]',
        )}
      >
        <div
          role="tablist"
          className="inline-flex w-max min-w-0 max-w-none flex-nowrap items-stretch gap-0.5 py-0.5 pr-0.5"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.key}
              id={`chat-tab-${tab.key}`}
              type="button"
              role="tab"
              title={tab.label}
              aria-label={
                tab.key === 'chat' && chatBadgeLabel != null
                  ? chatBadgeLabel === '99+'
                    ? t('tabWithUnreadMentionsCapped', { tabLabel: tab.label })
                    : t('tabChatWithMentionCount', {
                        tabLabel: tab.label,
                        count: chatMentionCount,
                      })
                  : tab.key === 'mentions' && mentionBadgeLabel != null
                  ? mentionBadgeLabel === '99+'
                    ? t('tabWithUnreadMentionsCapped', {
                        tabLabel: tab.label,
                      })
                    : t('tabMentionsWithMentionCount', {
                        tabLabel: tab.label,
                        count: mentionTabBadgeCount,
                      })
                  : undefined
              }
              aria-selected={activeTab === tab.key}
              aria-controls={`chat-tabpanel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              onClick={() => {
                onTabChange(tab.key);
                requestAnimationFrame(() =>
                  scrollTabIntoRailIfClipped(tab.key),
                );
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                'shrink-0 select-none',
                'inline-flex min-w-0 items-center',
                'whitespace-nowrap rounded-md px-2 py-1 text-left text-xs font-medium',
                'transition-colors duration-150 sm:px-2.5',
                activeTab === tab.key
                  ? 'border border-accent-9/40 bg-accent-9/10 text-foreground dark:border-accent-10/40 dark:bg-accent-9/14'
                  : 'border border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate" title={tab.label}>
                  {tab.label}
                </span>
                {tab.key === 'chat' && chatBadgeLabel != null ? (
                  <CountBadge
                    label={chatBadgeLabel}
                    count={chatMentionCount}
                    capped={chatMentionCountCapped}
                  />
                ) : null}
                {tab.key === 'mentions' && mentionBadgeLabel != null ? (
                  <CountBadge
                    label={mentionBadgeLabel}
                    count={mentionTabBadgeCount}
                    capped={mentionTabBadgeCapped}
                  />
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>
      {hasEndCluster ? (
        <div className="relative z-10 flex shrink-0 items-center justify-end gap-1 self-stretch border-s border-border/40 bg-background ps-1.5 min-w-max">
          {tabRowEnd}
        </div>
      ) : null}
    </div>
  );
}
