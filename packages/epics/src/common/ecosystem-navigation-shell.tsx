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
 * Exclusive view control, same Tabs `switch` contract as NetworkMapViewToggle.
 * Drawn as the space chrome: 40px labeled height, square, one hairline frame.
 * Ink labels. Active edge is the space accent (space-tab underline), not a
 * filled track and not a full-width accent box.
 */
const ecosystemViewListClass =
  'flex h-auto w-max max-w-full shrink-0 flex-col items-stretch self-start rounded-none border border-border/70 bg-transparent p-0';

const ecosystemViewTriggerClass = cn(
  'mr-0 h-10 min-h-10 w-full justify-center gap-2 whitespace-nowrap rounded-none px-3 py-0',
  'border-x-0 border-t-0 border-b border-border/70 bg-transparent text-foreground shadow-none',
  'last:border-b-0',
  'hover:bg-foreground/5 hover:text-foreground',
  'data-[state=active]:!border-b data-[state=active]:border-x-0 data-[state=active]:border-t-0 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
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

        <div className="flex min-w-0 flex-row items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col">
            {afterTabsContent ? (
              <div className="mb-4 min-w-0">{afterTabsContent}</div>
            ) : null}
            {tabs.map((tab) => (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className={
                  tab.value === activeTab
                    ? cn(
                        'mt-0 flex min-h-0 flex-1 flex-col outline-none',
                        visualizationClassName,
                      )
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
            className={ecosystemViewListClass}
          >
            {tabs.map((tab) => {
              const Icon = VIEW_ICONS[tab.value];
              return (
                <TabsTrigger
                  key={tab.value}
                  variant="switch"
                  value={tab.value}
                  className={ecosystemViewTriggerClass}
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
