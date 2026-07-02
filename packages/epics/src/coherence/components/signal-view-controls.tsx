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
import type { SignalViewMode } from './signal-section';

type SignalViewControlsProps = {
  viewMode: SignalViewMode;
  onViewModeChange: (mode: SignalViewMode) => void;
  hideArchived: boolean;
  onHideArchivedChange: (checked: boolean) => void;
  workflowSettingsHref?: string | null;
};

export function SignalViewControls({
  viewMode,
  onViewModeChange,
  hideArchived,
  onHideArchivedChange,
  workflowSettingsHref,
}: SignalViewControlsProps) {
  const t = useTranslations('CoherenceTab');

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {workflowSettingsHref ? (
          <div className="inline-flex h-10 items-center rounded-lg bg-neutral-3 px-1">
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
        >
          <TabsList triggerVariant="switch" className="w-fit">
            <TabsTrigger value="board" variant="switch">
              {t('signalViewBoard')}
            </TabsTrigger>
            <TabsTrigger value="swimlane" variant="switch">
              {t('signalViewSwimlane')}
            </TabsTrigger>
            <TabsTrigger value="list" variant="switch">
              {t('signalViewList')}
            </TabsTrigger>
            <TabsTrigger value="grid" variant="switch">
              {t('signalViewGrid')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox
          checked={hideArchived}
          onCheckedChange={(checked) => onHideArchivedChange(checked === true)}
        />
        {t('hideArchived')}
      </label>
    </>
  );
}
