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
};

export function EcosystemNavigationShell({
  activeTab,
  onTabChange,
  tabs,
  className,
  visualizationClassName,
}: EcosystemNavigationShellProps) {
  return (
    <div
      className={[
        'relative overflow-visible rounded-none border-0 bg-transparent p-0',
        className ?? '',
      ].join(' ')}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 bottom-3 h-16 rounded-full bg-accent-9/15 blur-3xl"
      />
      <div className="relative z-10 flex min-h-0 flex-col gap-4">
        <Tabs
          value={activeTab}
          onValueChange={onTabChange}
          className="flex min-h-0 flex-col gap-4"
        >
          <TabsList triggerVariant="switch" className="w-fit">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} variant="switch" value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

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
    </div>
  );
}
