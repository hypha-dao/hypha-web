'use client';

import { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ArrowLeftRight, Layers, Workflow } from 'lucide-react';
import { useTranslations } from 'next-intl';

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

const VIEW_ICONS: Record<string, typeof Layers> = {
  'nested-spaces': Layers,
  'space-to-space': ArrowLeftRight,
  'values-flows': Workflow,
};

/**
 * Exclusive view control — same 40px labeled height as other product actions.
 * Square, hairline, no fill. Active state takes the space accent border only.
 */
const ecosystemViewTriggerClass = cn(
  'mr-0 h-10 min-h-10 justify-start gap-2 whitespace-nowrap rounded-none px-3 py-0',
  'border border-border/70 bg-transparent shadow-none',
  'text-muted-foreground hover:border-foreground/30 hover:bg-transparent hover:text-foreground',
  'data-[state=active]:border-accent-9 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
);

export function EcosystemNavigationShell({
  activeTab,
  onTabChange,
  tabs,
  className,
  visualizationClassName,
  beforeTabsContent,
  afterTabsContent,
}: EcosystemNavigationShellProps) {
  const t = useTranslations('SelectNavigationAction');

  return (
    <div className={cn('relative flex min-h-0 flex-col gap-5', className)}>
      <Tabs
        value={activeTab}
        onValueChange={onTabChange}
        className="flex min-h-0 flex-col gap-4"
      >
        {beforeTabsContent ? (
          <div className="w-full">{beforeTabsContent}</div>
        ) : null}

        <div className="flex min-w-0 flex-col-reverse gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            {afterTabsContent ? (
              <div className="mb-4 min-w-0">{afterTabsContent}</div>
            ) : null}
            {tabs.map((tab) => (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className={
                  tab.value === activeTab
                    ? cn('mt-0 outline-none', visualizationClassName)
                    : 'mt-0 outline-none'
                }
              >
                {tab.content}
              </TabsContent>
            ))}
          </div>

          <TabsList
            triggerVariant="switch"
            aria-label={t('title')}
            className="flex h-auto w-full shrink-0 flex-row flex-wrap items-center justify-start gap-1.5 bg-transparent p-0 lg:grid lg:w-max lg:max-w-full lg:grid-cols-[max-content] lg:justify-items-stretch"
          >
            {tabs.map((tab) => {
              const Icon = VIEW_ICONS[tab.value];
              return (
                <TabsTrigger
                  key={tab.value}
                  variant="outlined"
                  value={tab.value}
                  className={cn(ecosystemViewTriggerClass, 'w-auto lg:w-full')}
                >
                  {Icon ? (
                    <Icon
                      className="craft-icon"
                      strokeWidth={1.25}
                      aria-hidden
                    />
                  ) : null}
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
      </Tabs>
    </div>
  );
}
