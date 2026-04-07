'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

export type ChatPanelTab = 'chat' | 'members';

type HumanChatPanelTabsProps = {
  activeTab: ChatPanelTab;
  onTabChange: (tab: ChatPanelTab) => void;
};

export function HumanChatPanelTabs({
  activeTab,
  onTabChange,
}: HumanChatPanelTabsProps) {
  const t = useTranslations('HumanChatPanel');

  const tabs: { key: ChatPanelTab; label: string }[] = [
    { key: 'chat', label: t('tabChat') },
    { key: 'members', label: t('tabMembers') },
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
    <div
      role="tablist"
      className="flex items-center gap-1 px-4 py-2 border-b border-border bg-background-2"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.key}
          id={`chat-tab-${tab.key}`}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.key}
          aria-controls={`chat-tabpanel-${tab.key}`}
          tabIndex={activeTab === tab.key ? 0 : -1}
          onClick={() => onTabChange(tab.key)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            activeTab === tab.key
              ? 'bg-secondary border border-border text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
