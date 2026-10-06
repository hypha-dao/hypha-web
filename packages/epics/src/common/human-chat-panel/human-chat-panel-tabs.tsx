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
      ref={tabRailScrollRef}
      className={cn(
        'relative box-border flex h-[var(--secondary-chrome-actions-row-height,66px)] w-full min-w-0 items-center border-b border-border/70 bg-transparent px-3',
        'overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x [scrollbar-width:thin]',
        /*
         * One row across the panel content box. `display: contents` on the
         * tablist and the end cluster lets each control (labels, phone, video)
         * be its own flex item, so justify-between gives equal gaps and the
         * same px-3 inset on both edges. Labels stay full width (no shrink).
         */
        hasEndCluster ? 'justify-between' : 'justify-start gap-0.5',
      )}
    >
      {/*
        role=tablist stays on this element so it only contains role=tab
        children. `contents` promotes those tabs into the row above.
      */}
      <div role="tablist" className="contents">
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
              requestAnimationFrame(() => scrollTabIntoRailIfClipped(tab.key));
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'shrink-0 select-none',
              'inline-flex h-[36px] items-center',
              'whitespace-nowrap rounded-none border-0 bg-transparent px-2.5 text-left font-sans text-xs font-medium',
              'transition-colors duration-150',
              activeTab === tab.key
                ? 'text-accent-11'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="whitespace-nowrap" title={tab.label}>
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
      {hasEndCluster ? <div className="contents">{tabRowEnd}</div> : null}
    </div>
  );
}
