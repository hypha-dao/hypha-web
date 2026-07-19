'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';
import type {
  SpaceOverviewFlowsData,
  SpaceOverviewMemoryData,
  SpaceOverviewSignalsData,
} from '@hypha-platform/core/client';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import {
  AreaTrendChart,
  DonutChart,
  HorizontalBarsChart,
  OverviewChartShell,
  RadialGauge,
  StatRibbon,
  VerticalBarsChart,
  accentColor,
} from './home-overview-charts';

function createOverviewFetcher(
  path: string,
  getAccessToken: (() => Promise<string | null>) | undefined,
) {
  return async () => {
    const token = await getAccessToken?.();
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(path, { headers });
    if (!response.ok) {
      throw new Error(`Failed to load overview data (${response.status})`);
    }
    return (await response.json()) as unknown;
  };
}

function OverviewMetricsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <Skeleton key={index} className="h-56" />
      ))}
    </div>
  );
}

function OverviewMetricsError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
    </Card>
  );
}

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];

function sortByPriority<T extends { priority: string; count: number }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const aRank = PRIORITY_ORDER.indexOf(a.priority.toLowerCase());
    const bRank = PRIORITY_ORDER.indexOf(b.priority.toLowerCase());
    const safeA = aRank < 0 ? PRIORITY_ORDER.length : aRank;
    const safeB = bRank < 0 ? PRIORITY_ORDER.length : bRank;
    if (safeA !== safeB) return safeA - safeB;
    return b.count - a.count;
  });
}

export function OverviewSignalsDashboard({ spaceSlug }: { spaceSlug: string }) {
  const { getAccessToken } = useAuthentication();
  const t = useTranslations('TokenHoldingsDashboard');
  const { data, error, isLoading } = useSWR(
    ['space-overview-signals', spaceSlug],
    createOverviewFetcher(
      `/api/v1/spaces/${spaceSlug}/overview-signals`,
      getAccessToken,
    ),
    { revalidateOnFocus: true, refreshInterval: 120_000 },
  );

  if (isLoading) return <OverviewMetricsSkeleton />;
  if (error || !data) {
    return (
      <OverviewMetricsError
        title={t('signalsDashboard.errorTitle')}
        message={t('signalsDashboard.error')}
      />
    );
  }

  const payload = data as SpaceOverviewSignalsData;
  const statusSlices = payload.byStatus.map((row, index) => ({
    label: row.status,
    value: row.count,
    color: accentColor(index),
  }));
  const typeSlices = payload.byType.map((row, index) => ({
    label: row.type,
    value: row.count,
    color: accentColor(index),
  }));
  const priorityItems = sortByPriority(payload.byPriority).map(
    (row, index) => ({
      label: row.priority,
      value: row.count,
      color: accentColor(index + 2),
    }),
  );
  const weeklyPoints = payload.weekly.map((row) => ({
    label: row.week,
    value: row.count,
  }));

  return (
    <div className="space-y-4">
      <StatRibbon
        items={[
          {
            label: t('signalsDashboard.total'),
            value: payload.summary.totalSignals,
            hint: t('signalsDashboard.totalHint', {
              count: payload.summary.createdLast7d,
            }),
          },
          {
            label: t('signalsDashboard.last24h'),
            value: payload.summary.createdLast24h,
          },
          {
            label: t('signalsDashboard.queuePending'),
            value: payload.orchestrator.queue_pending,
          },
          {
            label: t('signalsDashboard.queueFailed'),
            value: payload.orchestrator.queue_failed,
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <OverviewChartShell
          title={t('signalsDashboard.byStatus')}
          subtitle={t('signalsDashboard.byStatusSubtitle')}
        >
          <DonutChart
            data={statusSlices}
            centerValue={payload.summary.totalSignals}
            centerLabel={t('signalsDashboard.total')}
            emptyLabel={t('signalsDashboard.noData')}
          />
        </OverviewChartShell>
        <OverviewChartShell
          title={t('signalsDashboard.byType')}
          subtitle={t('signalsDashboard.byTypeSubtitle')}
        >
          <HorizontalBarsChart
            items={typeSlices}
            emptyLabel={t('signalsDashboard.noData')}
          />
        </OverviewChartShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <OverviewChartShell
          title={t('signalsDashboard.byPriority')}
          subtitle={t('signalsDashboard.byPrioritySubtitle')}
        >
          <HorizontalBarsChart
            items={priorityItems}
            emptyLabel={t('signalsDashboard.noData')}
          />
        </OverviewChartShell>
        <OverviewChartShell
          title={t('signalsDashboard.weeklyVelocity')}
          subtitle={t('signalsDashboard.weeklyVelocitySubtitle')}
        >
          <AreaTrendChart
            points={weeklyPoints}
            emptyLabel={t('signalsDashboard.noData')}
          />
        </OverviewChartShell>
      </div>

      <StatRibbon
        items={[
          {
            label: t('signalsDashboard.emitted24h'),
            value: payload.orchestrator.signals_emitted_last_24h,
          },
          {
            label: t('signalsDashboard.relays24h'),
            value: payload.orchestrator.relays_emitted_last_24h,
          },
        ]}
      />
    </div>
  );
}

export function OverviewMemoryDashboard({ spaceSlug }: { spaceSlug: string }) {
  const { getAccessToken } = useAuthentication();
  const t = useTranslations('TokenHoldingsDashboard');
  const { data, error, isLoading } = useSWR(
    ['space-overview-memory', spaceSlug],
    createOverviewFetcher(
      `/api/v1/spaces/${spaceSlug}/overview-memory`,
      getAccessToken,
    ),
    { revalidateOnFocus: true, refreshInterval: 120_000 },
  );

  if (isLoading) return <OverviewMetricsSkeleton />;
  if (error || !data) {
    return (
      <OverviewMetricsError
        title={t('memoryDashboard.errorTitle')}
        message={t('memoryDashboard.error')}
      />
    );
  }

  const payload = data as SpaceOverviewMemoryData;
  const memoryTotal =
    payload.summary.summariesTotal +
    payload.summary.transcriptsTotal +
    payload.summary.recordingsTotal;

  return (
    <div className="space-y-4">
      <OverviewChartShell
        title={t('memoryDashboard.title')}
        subtitle={
          payload.summary.hasChat
            ? t('memoryDashboard.hasChat')
            : t('memoryDashboard.noChat')
        }
      >
        <DonutChart
          data={[
            {
              label: t('memoryDashboard.summaries'),
              value: payload.summary.summariesTotal,
              color: accentColor(0),
            },
            {
              label: t('memoryDashboard.transcripts'),
              value: payload.summary.transcriptsTotal,
              color: accentColor(1),
            },
            {
              label: t('memoryDashboard.recordings'),
              value: payload.summary.recordingsTotal,
              color: accentColor(2),
            },
          ]}
          centerValue={memoryTotal}
          centerLabel={t('memoryDashboard.items')}
          emptyLabel={t('memoryDashboard.noData')}
        />
      </OverviewChartShell>
      <StatRibbon
        items={[
          {
            label: t('memoryDashboard.summaries7d'),
            value: payload.summary.summariesLast7d,
            hint: t('memoryDashboard.summaries24h', {
              count: payload.summary.summariesLast24h,
            }),
          },
        ]}
      />
    </div>
  );
}

export function OverviewFlowsDashboard({ spaceSlug }: { spaceSlug: string }) {
  const { getAccessToken } = useAuthentication();
  const t = useTranslations('TokenHoldingsDashboard');
  const { data, error, isLoading } = useSWR(
    ['space-overview-flows', spaceSlug],
    createOverviewFetcher(
      `/api/v1/spaces/${spaceSlug}/overview-flows`,
      getAccessToken,
    ),
    {
      revalidateOnFocus: false,
      refreshInterval: 900_000,
      dedupingInterval: 300_000,
    },
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card className="border-border/60 bg-card/95">
          <CardHeader>
            <CardTitle>{t('flowsDashboard.loadingTitle')}</CardTitle>
            <CardDescription>{t('flowsDashboard.loading')}</CardDescription>
          </CardHeader>
        </Card>
        <OverviewMetricsSkeleton />
      </div>
    );
  }
  if (error || !data) {
    return (
      <OverviewMetricsError
        title={t('flowsDashboard.errorTitle')}
        message={t('flowsDashboard.error')}
      />
    );
  }

  const payload = data as SpaceOverviewFlowsData;
  const payingSummary = payload.summary;
  const payingSpaces = payload.spaces;
  const totalHyphaBurned = Number.parseFloat(payingSummary.totalHyphaBurned);
  const hyphaBurnedDisplay = Number.isFinite(totalHyphaBurned)
    ? totalHyphaBurned.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : payingSummary.totalHyphaBurned;
  const monthlyBars = payload.monthly.slice(-8).map((row, index) => ({
    label: row.month.slice(5),
    value: row.spacesActivated,
    color: accentColor(index),
  }));

  return (
    <div className="space-y-4">
      <StatRibbon
        items={[
          {
            label: t('flowsDashboard.hyphaPaidSpaces'),
            value: payingSummary.hyphaPaidSpaces,
            hint: t('flowsDashboard.hyphaPaidSpacesHint', {
              active: payingSummary.activePaidSpaces,
              expired: payingSummary.expiredPaidSpaces,
            }),
          },
          {
            label: t('flowsDashboard.totalHyphaBurned'),
            value: hyphaBurnedDisplay,
          },
          {
            label: t('flowsDashboard.trackedSpaces'),
            value: payingSummary.totalSpaces,
          },
          {
            label: t('flowsDashboard.paymentEventsLabel'),
            value: payingSummary.paymentEventsInRange,
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <OverviewChartShell
          title={t('flowsDashboard.paymentsByMonth')}
          subtitle={t('flowsDashboard.paymentsByMonthSubtitle')}
        >
          <VerticalBarsChart
            items={monthlyBars}
            emptyLabel={t('flowsDashboard.noData')}
          />
        </OverviewChartShell>
        <OverviewChartShell title={t('flowsDashboard.breakdown')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <RadialGauge
              value={payingSummary.activePaidSpaces}
              max={Math.max(payingSummary.hyphaPaidSpaces, 1)}
              label={t('flowsDashboard.activePaid')}
              hint={`${payingSummary.activePaidSpaces} / ${payingSummary.hyphaPaidSpaces}`}
            />
            <RadialGauge
              value={payingSummary.expiredPaidSpaces}
              max={Math.max(payingSummary.hyphaPaidSpaces, 1)}
              label={t('flowsDashboard.expiredPaid')}
              hint={`${payingSummary.expiredPaidSpaces} / ${payingSummary.hyphaPaidSpaces}`}
            />
          </div>
        </OverviewChartShell>
      </div>

      <OverviewChartShell
        title={t('flowsDashboard.payingSpacesTitle')}
        subtitle={t('flowsDashboard.payingSpacesSubtitle', {
          count: payingSpaces.length,
        })}
      >
        {payingSpaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('flowsDashboard.noData')}
          </p>
        ) : (
          <HorizontalBarsChart
            items={payingSpaces.slice(0, 8).map((space, index) => ({
              label: space.title,
              value: Number.parseFloat(space.totalHyphaPaid) || 0,
              color: accentColor(index),
            }))}
            emptyLabel={t('flowsDashboard.noData')}
          />
        )}
      </OverviewChartShell>
    </div>
  );
}

export function OverviewGovernanceDashboard({
  proposals,
}: {
  proposals: { onVoting: number; accepted: number; refused: number };
}) {
  const t = useTranslations('TokenHoldingsDashboard');
  const total = proposals.onVoting + proposals.accepted + proposals.refused;
  const acceptanceRate = total > 0 ? proposals.accepted / total : 0;

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <OverviewChartShell
        title={t('governanceDashboard.health')}
        subtitle={t('governanceDashboard.healthSubtitle')}
      >
        <RadialGauge
          value={proposals.accepted}
          max={Math.max(total, 1)}
          label={t('governanceDashboard.acceptanceRate')}
          hint={t('governanceDashboard.acceptanceHint', {
            percent: Math.round(acceptanceRate * 100),
          })}
        />
      </OverviewChartShell>
      <OverviewChartShell title={t('governanceDashboard.mix')}>
        <DonutChart
          data={[
            {
              label: t('proposals.onVoting'),
              value: proposals.onVoting,
              color: accentColor(0),
            },
            {
              label: t('proposals.accepted'),
              value: proposals.accepted,
              color: accentColor(1),
            },
            {
              label: t('proposals.refused'),
              value: proposals.refused,
              color: accentColor(3),
            },
          ]}
          centerValue={total}
          centerLabel={t('governanceDashboard.total')}
          emptyLabel={t('proposals.noData')}
        />
      </OverviewChartShell>
    </div>
  );
}
