'use client';

import { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hypha-platform/ui';

type EcosystemNavigationTab = {
  value: string;
  label: string;
  content: ReactNode;
};

type EcosystemNavigationShellProps = {
  activeTab: string;
  onTabChange: (value: string) => void;
  tabs: EcosystemNavigationTab[];
  className?: string;
  visualizationClassName?: string;
  beforeTabsContent?: ReactNode;
  afterTabsContent?: ReactNode;
};

export function EcosystemNavigationShell({
  activeTab,
  onTabChange,
  tabs,
  className,
  visualizationClassName,
  beforeTabsContent,
  afterTabsContent,
}: EcosystemNavigationShellProps) {
  return (
    <div
      className={['relative flex min-h-0 flex-col gap-4', className ?? ''].join(
        ' ',
      )}
    >
      <Tabs
        value={activeTab}
        onValueChange={onTabChange}
        className="flex min-h-0 flex-col gap-4"
      >
        {beforeTabsContent ? (
          <div className="w-full">{beforeTabsContent}</div>
        ) : null}

        <div className="flex w-full flex-wrap items-center gap-4">
          <TabsList triggerVariant="switch" className="w-fit shrink-0">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} variant="switch" value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {afterTabsContent ? (
            <div className="min-w-0 flex-1">{afterTabsContent}</div>
          ) : null}
        </div>

        {tabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className={tab.value === activeTab ? visualizationClassName : ''}
          >
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
