'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Cog } from 'lucide-react';
import {
  Button,
  Checkbox,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import type { SignalViewMode } from './signal-section';

type SignalViewControlsProps = {
  viewMode: SignalViewMode;
  onViewModeChange: (mode: SignalViewMode) => void;
  hideArchived: boolean;
  onHideArchivedChange: (checked: boolean) => void;
  workflowSettingsHref?: string | null;
  className?: string;
};

export function SignalViewControls({
  viewMode,
  onViewModeChange,
  hideArchived,
  onHideArchivedChange,
  workflowSettingsHref,
  className,
}: SignalViewControlsProps) {
  const t = useTranslations('CoherenceTab');

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
        <div className="inline-flex w-max flex-nowrap items-center gap-2">
          {workflowSettingsHref ? (
            <div className="inline-flex h-10 shrink-0 items-center rounded-lg bg-neutral-3 px-1">
              <Button
                asChild
                type="button"
                variant="ghost"
                colorVariant="neutral"
                size="sm"
                className="h-8 min-h-0 w-8 shrink-0 rounded-lg p-0 text-muted-foreground hover:text-foreground"
              >
                <Link
                  href={workflowSettingsHref}
                  scroll={false}
                  aria-label={t('signalWorkflowSettings')}
                  title={t('signalWorkflowSettings')}
                >
                  <Cog className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                </Link>
              </Button>
            </div>
          ) : null}
          <Tabs
            value={viewMode}
            onValueChange={(value) => onViewModeChange(value as SignalViewMode)}
            className="shrink-0"
          >
            <TabsList triggerVariant="switch" className="w-fit">
              <TabsTrigger value="grid" variant="switch">
                {t('signalViewGrid')}
              </TabsTrigger>
              <TabsTrigger value="board" variant="switch">
                {t('signalViewBoard')}
              </TabsTrigger>
              <TabsTrigger value="swimlane" variant="switch">
                {t('signalViewSwimlane')}
              </TabsTrigger>
              <TabsTrigger value="list" variant="switch">
                {t('signalViewList')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[14px]">
        <Checkbox
          id="hideArchivedSignalsCheckbox"
          className="border-accent-8/80 data-[state=checked]:border-accent-9 data-[state=checked]:bg-accent-9 data-[state=checked]:text-accent-contrast focus-visible:ring-accent-8"
          checked={hideArchived}
          onCheckedChange={(checked) => onHideArchivedChange(checked === true)}
        />
        {t('hideArchived')}
      </label>
    </div>
  );
}
