import { FC } from 'react';
import { Tabs, TabsList, TabsTrigger } from '../server';

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
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
