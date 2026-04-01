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

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-background-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onTabChange(tab.key)}
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
