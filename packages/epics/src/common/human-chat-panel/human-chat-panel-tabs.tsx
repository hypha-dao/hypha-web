'use client';

import type { ReactNode } from 'react';
import { useLayoutEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
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

  const chatBadgeLabel =
    chatMentionCount > 0
      ? chatMentionCountCapped || chatMentionCount >= 100
        ? '99+'
        : String(chatMentionCount)
      : null;

  const mentionBadgeLabel =
    mentionTabBadgeCount > 0
      ? mentionTabBadgeCapped || mentionTabBadgeCount >= 100
        ? '99+'
        : String(mentionTabBadgeCount)
      : null;

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
    if (activeTab !== 'mentions') return;
    const el = document.getElementById('chat-tab-mentions');
    const rail = tabRailScrollRef.current;
    if (!el || !rail) return;
    const elRect = el.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    if (elRect.left < railRect.left || elRect.right > railRect.right) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [activeTab]);

  return (
    <div
      className={cn(
        'relative w-full min-w-0 border-b border-border bg-transparent px-4 py-2',
        'min-h-[var(--secondary-chrome-actions-row-height,52px)]',
        /* §3.1.1: tab column scrolls; call + settings column is `auto` and does not shrink. */
        'grid w-full min-w-0 items-center',
        hasEndCluster
          ? 'grid-cols-[minmax(0,1fr)_auto] gap-x-2'
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
          className="inline-flex w-max min-w-0 max-w-none flex-nowrap items-stretch gap-1 py-0.5 pr-0.5"
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
              onClick={() => onTabChange(tab.key)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                'shrink-0 select-none',
                'inline-flex min-w-0 items-center',
                'whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-xs font-medium',
                'transition-colors duration-150 sm:px-3',
                activeTab === tab.key
                  ? 'border border-accent-9/40 bg-accent-9/18 text-foreground shadow-sm ring-1 ring-inset ring-accent-9/25 dark:border-accent-10/45 dark:bg-accent-9/22 dark:text-foreground dark:ring-accent-10/30'
                  : 'border border-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/80 hover:text-foreground',
              )}
            >
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate" title={tab.label}>
                  {tab.label}
                </span>
                {tab.key === 'chat' && chatBadgeLabel != null && (
                  <span
                    aria-hidden
                    className="inline-flex min-h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full border border-accent-9/35 bg-accent-9 px-1.5 text-[10px] font-semibold leading-none text-accent-contrast tabular-nums shadow-sm"
                  >
                    {chatBadgeLabel}
                  </span>
                )}
                {tab.key === 'mentions' && mentionBadgeLabel != null && (
                  <span
                    aria-hidden
                    className="inline-flex min-h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full border border-accent-9/35 bg-accent-9 px-1.5 text-[10px] font-semibold leading-none text-accent-contrast tabular-nums shadow-sm"
                  >
                    {mentionBadgeLabel}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
      {hasEndCluster ? (
        <div className="flex min-h-0 min-w-0 flex-none items-center justify-end gap-1.5 self-stretch border-s border-border/50 bg-background ps-1.5">
          {tabRowEnd}
        </div>
      ) : null}
    </div>
  );
}
