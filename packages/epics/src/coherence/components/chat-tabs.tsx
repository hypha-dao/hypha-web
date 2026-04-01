import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import React from 'react';

const TABS = [
  { name: 'chat', title: 'Chat' },
  { name: 'members', title: 'Members' },
  { name: 'pins', title: 'Pins' },
];

export interface ChatTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const ChatTabs = ({ activeTab, setActiveTab }: ChatTabsProps) => {
  return (
    <Tabs
      className="flex flex-row gap-0"
      value={activeTab}
      onValueChange={setActiveTab}
    >
      <TabsList>
        {TABS.map(({ name, title }, index) => (
          <TabsTrigger key={`tab-${index}`} value={name}>
            {title}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};
