'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox, Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import type { SignalViewMode } from './signal-section';

type SignalViewControlsProps = {
  viewMode: SignalViewMode;
  onViewModeChange: (mode: SignalViewMode) => void;
  hideArchived: boolean;
  onHideArchivedChange: (checked: boolean) => void;
};

export function SignalViewControls({
  viewMode,
  onViewModeChange,
  hideArchived,
  onHideArchivedChange,
}: SignalViewControlsProps) {
  const t = useTranslations('CoherenceTab');

  return (
    <>
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
