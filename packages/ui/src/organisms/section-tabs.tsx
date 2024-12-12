import { FC } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui/server';

type Tab = {
  label: string;
  value: string;
};

type SectionTabsProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tabs: Tab[];
};

export const SectionTabs: FC<SectionTabsProps> = ({
  activeTab,
  setActiveTab,
  tabs,
}) => {
  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="w-full mt-3 mb-4"
    >
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} variant="outlined">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};
