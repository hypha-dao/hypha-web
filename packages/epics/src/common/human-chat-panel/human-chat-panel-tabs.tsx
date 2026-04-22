'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
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
  /** Notification centre URL for the gear at the end of the tab row (omit to hide). */
  notificationCentreHref?: string | null;
};

export function HumanChatPanelTabs({
  activeTab,
  onTabChange,
  chatMentionCount = 0,
  chatMentionCountCapped = false,
  mentionTabBadgeCount = 0,
  mentionTabBadgeCapped = false,
  notificationCentreHref,
}: HumanChatPanelTabsProps) {
  const t = useTranslations('HumanChatPanel');

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

  return (
    <div className="flex items-center gap-2 bg-transparent px-4 py-2">
      <div
        role="tablist"
        className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            id={`chat-tab-${tab.key}`}
            type="button"
            role="tab"
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
                  ? t('tabWithUnreadMentionsCapped', { tabLabel: tab.label })
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
              'rounded-lg px-3 py-1 text-xs font-medium transition-colors duration-150',
              activeTab === tab.key
                ? 'border border-accent-9/40 bg-accent-9/18 text-foreground shadow-sm ring-1 ring-inset ring-accent-9/25 dark:border-accent-10/45 dark:bg-accent-9/22 dark:text-foreground dark:ring-accent-10/30'
                : 'border border-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/80 hover:text-foreground',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <span>{tab.label}</span>
              {tab.key === 'chat' && chatBadgeLabel != null && (
                <span
                  aria-hidden
                  className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border border-accent-9/35 bg-accent-9 px-1.5 text-[10px] font-semibold leading-none text-accent-contrast tabular-nums shadow-sm"
                >
                  {chatBadgeLabel}
                </span>
              )}
              {tab.key === 'mentions' && mentionBadgeLabel != null && (
                <span
                  aria-hidden
                  className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border border-accent-9/35 bg-accent-9 px-1.5 text-[10px] font-semibold leading-none text-accent-contrast tabular-nums shadow-sm"
                >
                  {mentionBadgeLabel}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
      {notificationCentreHref ? (
        <Link
          href={notificationCentreHref}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t('mentionInboxNotificationSettings')}
          title={t('mentionInboxNotificationSettings')}
        >
          <Settings className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
