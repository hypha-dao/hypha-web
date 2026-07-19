'use client';

import type { PlatformDashboardData } from '@hypha-platform/core/client';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
} from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  PlatformBarChart,
  PlatformMetricCard,
} from './platform-dashboard-widgets';

type PlatformDashboardState = {
  data: PlatformDashboardData | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => void;
};

type PlatformDashboardAuth = {
  secretInput: string;
  setSecretInput: (value: string) => void;
  authenticate: () => void;
  isAuthenticated: boolean;
};

export function PlatformOpsAccessPrompt({
  auth,
}: {
  auth: PlatformDashboardAuth;
}) {
  const t = useTranslations('PlatformOverview');

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>{t('opsAccess.title')}</CardTitle>
        <CardDescription>{t('opsAccess.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="password"
          placeholder={t('opsAccess.placeholder')}
          value={auth.secretInput}
          onChange={(event) => auth.setSecretInput(event.target.value)}
          className="sm:max-w-sm"
        />
        <Button
          disabled={!auth.secretInput.trim()}
          onClick={auth.authenticate}
          className="shrink-0"
        >
          {t('opsAccess.continue')}
        </Button>
      </CardContent>
    </Card>
  );
}

function PlatformDashboardStatus({ state }: { state: PlatformDashboardState }) {
  const t = useTranslations('PlatformOverview');

  if (state.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-48" />
        ))}
      </div>
    );
  }

  if (state.error) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <p className="text-destructive">{state.error}</p>
          <Button variant="outline" onClick={() => void state.refresh()}>
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}

export function PlatformActivitySection({
  state,
}: {
  state: PlatformDashboardState;
}) {
  const t = useTranslations('PlatformOverview');
  const status = <PlatformDashboardStatus state={state} />;
  if (state.isLoading || state.error || !state.data) {
    return status;
  }

  const { data } = state;
  const topSignalSpaces = data.signals.bySpace.slice(0, 10);
  const topMemorySpaces = data.spaceMemory.bySpace.summaries.slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-5 font-semibold">{t('activity.heading')}</h2>
          <p className="text-3 text-muted-foreground">
            {t('updatedAt', {
              date: new Date(data.generatedAt).toLocaleString(),
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void state.refresh()}
        >
          {t('refresh')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PlatformMetricCard
          label={t('activity.signals')}
          value={data.signals.summary.totalSignals}
          hint={t('activity.signalsHint', {
            count: data.signals.summary.createdLast7d,
          })}
        />
        <PlatformMetricCard
          label={t('activity.spaceMemory')}
          value={
            data.spaceMemory.summary.summariesTotal +
            data.spaceMemory.summary.transcriptsTotal +
            data.spaceMemory.summary.recordingsTotal
          }
          hint={t('activity.spaceMemoryHint', {
            count: data.spaceMemory.summary.spacesWithChat,
          })}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PlatformBarChart
          title={t('activity.signalsByType')}
          items={data.signals.byType.map((row) => ({
            label: row.type,
            value: row.count,
          }))}
          labelKey="label"
          valueKey="value"
          emptyLabel={t('noData')}
        />
        <PlatformBarChart
          title={t('activity.signalsByPriority')}
          items={data.signals.byPriority.map((row) => ({
            label: row.priority,
            value: row.count,
          }))}
          labelKey="label"
          valueKey="value"
          emptyLabel={t('noData')}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PlatformBarChart
          title={t('activity.topSpacesBySignals')}
          items={topSignalSpaces.map((row) => ({
            label: row.title,
            value: row.count,
          }))}
          labelKey="label"
          valueKey="value"
          emptyLabel={t('noData')}
        />
        <Card>
          <CardHeader>
            <CardTitle>{t('activity.orchestrator')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <PlatformMetricCard
              label={t('activity.queuePending')}
              value={data.signals.orchestrator.queue_pending}
            />
            <PlatformMetricCard
              label={t('activity.queueFailed')}
              value={data.signals.orchestrator.queue_failed}
            />
            <PlatformMetricCard
              label={t('activity.signalsEmitted24h')}
              value={data.signals.orchestrator.signals_emitted_last_24h}
            />
            <PlatformMetricCard
              label={t('activity.relaysEmitted24h')}
              value={data.signals.orchestrator.relays_emitted_last_24h}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PlatformBarChart
          title={t('activity.memoryBySpace')}
          items={topMemorySpaces.map((row) => ({
            label: row.title,
            value: row.count,
          }))}
          labelKey="label"
          valueKey="value"
          emptyLabel={t('noData')}
        />
        <Card>
          <CardHeader>
            <CardTitle>{t('activity.memoryTotals')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <PlatformMetricCard
              label={t('activity.summaries')}
              value={data.spaceMemory.summary.summariesTotal}
              hint={t('activity.summaries24h', {
                count: data.spaceMemory.summary.summariesLast24h,
              })}
            />
            <PlatformMetricCard
              label={t('activity.transcripts')}
              value={data.spaceMemory.summary.transcriptsTotal}
            />
            <PlatformMetricCard
              label={t('activity.recordings')}
              value={data.spaceMemory.summary.recordingsTotal}
            />
            <PlatformMetricCard
              label={t('activity.summaries7d')}
              value={data.spaceMemory.summary.summariesLast7d}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function PlatformDistributionSection({
  state,
}: {
  state: PlatformDashboardState;
}) {
  const t = useTranslations('PlatformOverview');
  const status = <PlatformDashboardStatus state={state} />;
  if (state.isLoading || state.error || !state.data) {
    return status;
  }

  const { data } = state;
  const payingSummary = data.payingSpaces.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-5 font-semibold">{t('distribution.heading')}</h2>
          <p className="text-3 text-muted-foreground">
            {t('updatedAt', {
              date: new Date(data.generatedAt).toLocaleString(),
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void state.refresh()}
        >
          {t('refresh')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PlatformMetricCard
          label={t('distribution.hyphaPaidSpaces')}
          value={payingSummary.hyphaPaidSpaces}
          hint={t('distribution.hyphaPaidSpacesHint', {
            active: payingSummary.activePaidSpaces,
            expired: payingSummary.expiredPaidSpaces,
          })}
        />
        <PlatformMetricCard
          label={t('distribution.totalHyphaBurned')}
          value={Number(payingSummary.totalHyphaBurned).toLocaleString(
            undefined,
            { maximumFractionDigits: 0 },
          )}
        />
        <PlatformMetricCard
          label={t('distribution.freeTrialOnly')}
          value={payingSummary.freeTrialOnly}
        />
        <PlatformMetricCard
          label={t('distribution.trackedSpaces')}
          value={payingSummary.totalSpaces}
          hint={t('distribution.paymentEvents', {
            count: payingSummary.paymentEventsInRange,
          })}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PlatformBarChart
          title={t('distribution.paymentsByMonth')}
          items={data.payingSpaces.monthly.map((bucket) => ({
            label: bucket.month,
            value: bucket.spacesActivated,
          }))}
          labelKey="label"
          valueKey="value"
          emptyLabel={t('noData')}
        />
        <Card>
          <CardHeader>
            <CardTitle>{t('distribution.breakdown')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <PlatformMetricCard
              label={t('distribution.activePaid')}
              value={payingSummary.activePaidSpaces}
            />
            <PlatformMetricCard
              label={t('distribution.expiredPaid')}
              value={payingSummary.expiredPaidSpaces}
            />
            <PlatformMetricCard
              label={t('distribution.paymentEventsLabel')}
              value={payingSummary.paymentEventsInRange}
            />
            <PlatformMetricCard
              label={t('distribution.totalHyphaBurned')}
              value={Number(payingSummary.totalHyphaBurned).toLocaleString(
                undefined,
                { maximumFractionDigits: 0 },
              )}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function PlatformAssetsSection({
  state,
}: {
  state: PlatformDashboardState;
}) {
  const locale = useLocale();
  const t = useTranslations('PlatformOverview');
  const status = <PlatformDashboardStatus state={state} />;
  if (state.isLoading || state.error || !state.data) {
    return status;
  }

  const { data } = state;
  const topAssetSpaces = data.assets.spaces.slice(0, 12);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-5 font-semibold">{t('assets.heading')}</h2>
          <p className="text-3 text-muted-foreground">
            {t('updatedAt', {
              date: new Date(data.generatedAt).toLocaleString(),
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void state.refresh()}
        >
          {t('refresh')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PlatformMetricCard
          label={t('assets.totalBalance')}
          value={formatCurrencyValue(data.assets.totalBalanceUsd)}
          hint={t('assets.spacesTracked', { count: data.assets.spaceCount })}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {topAssetSpaces.map((space) => (
          <Card key={space.slug}>
            <CardHeader className="pb-2">
              <CardTitle className="text-4">
                <Link
                  href={`/${locale}/dho/${space.slug}/treasury`}
                  className="hover:underline"
                >
                  {space.title}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-5 font-semibold">
                {formatCurrencyValue(space.balanceUsd)}
              </p>
              <div className="space-y-1">
                {space.topAssets.map((asset) => (
                  <div
                    key={`${space.slug}-${asset.symbol}`}
                    className="flex justify-between text-2 text-muted-foreground"
                  >
                    <span>{asset.symbol}</span>
                    <span>{formatCurrencyValue(asset.usdEqual)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export type PlatformOverviewTab = 'activity' | 'distribution' | 'assets';

export function PlatformOverviewPanel({
  tab,
  auth,
  state,
}: {
  tab: PlatformOverviewTab;
  auth: PlatformDashboardAuth;
  state: PlatformDashboardState;
}) {
  if (!auth.isAuthenticated) {
    return <PlatformOpsAccessPrompt auth={auth} />;
  }

  if (tab === 'activity') {
    return <PlatformActivitySection state={state} />;
  }
  if (tab === 'distribution') {
    return <PlatformDistributionSection state={state} />;
  }
  return <PlatformAssetsSection state={state} />;
}
