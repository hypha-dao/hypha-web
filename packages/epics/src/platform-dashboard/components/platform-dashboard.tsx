'use client';

import * as React from 'react';
import { Button } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { PlatformDashboardGate } from './platform-dashboard-gate';
import {
  PlatformActivitySection,
  PlatformAssetsSection,
  PlatformDistributionSection,
} from './platform-dashboard-sections';
import { usePlatformDashboard } from '../hooks/use-platform-dashboard';

function PlatformDashboardContent({
  fetchDashboard,
}: {
  fetchDashboard: () => Promise<Response>;
}) {
  const t = useTranslations('PlatformOverview');
  const state = usePlatformDashboard(fetchDashboard);

  if (state.isLoading) {
    return null;
  }

  if (state.error || !state.data) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-destructive">{state.error ?? t('unavailable')}</p>
        <Button onClick={() => void state.refresh()}>{t('retry')}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-7 font-semibold">{t('title')}</h1>
          <p className="text-3 text-muted-foreground">
            {t('updatedAt', {
              date: new Date(state.data.generatedAt).toLocaleString(),
            })}
          </p>
        </div>
        <Button variant="outline" onClick={() => void state.refresh()}>
          {t('refresh')}
        </Button>
      </div>

      <PlatformDistributionSection state={state} />
      <PlatformAssetsSection state={state} />
      <PlatformActivitySection state={state} />
    </div>
  );
}

/** @deprecated Use overview home tabs with PlatformOverviewPanel instead. */
export function PlatformDashboard() {
  return (
    <PlatformDashboardGate>
      {(fetchDashboard) => (
        <PlatformDashboardContent fetchDashboard={fetchDashboard} />
      )}
    </PlatformDashboardGate>
  );
}
