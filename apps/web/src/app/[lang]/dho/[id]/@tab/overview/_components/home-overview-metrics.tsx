'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';
import type {
  SpaceActivationClassification,
  SpaceOverviewFlowsData,
  SpaceOverviewMemoryData,
  SpaceOverviewSignalsData,
} from '@hypha-platform/core/client';
import {
  Badge,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
} from '@hypha-platform/ui';
import { BookMarked, FileText, Mic, Video } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AreaTrendChart,
  DonutChart,
  HorizontalBarsChart,
  OverviewChartShell,
  RadialGauge,
  SPACE_ACCENT,
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

function fillPriorityBuckets<T extends { priority: string; count: number }>(
  rows: T[],
): T[] {
  const counts = new Map(
    rows.map((row) => [row.priority.toLowerCase(), row.count]),
  );
  const known = PRIORITY_ORDER.map(
    (priority) =>
      ({
        priority,
        count: counts.get(priority) ?? 0,
      } as T),
  );
  const extras = rows.filter(
    (row) => !PRIORITY_ORDER.includes(row.priority.toLowerCase()),
  );
  return [...known, ...extras];
}

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

export function OverviewSignalsDashboard({
  spaceSlug,
  afterSummary,
}: {
  spaceSlug: string;
  afterSummary?: React.ReactNode;
}) {
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
  const priorityItems = sortByPriority(
    fillPriorityBuckets(payload.byPriority),
  ).map((row, index) => ({
    label: row.priority,
    value: row.count,
    color: accentColor(index + 2),
  }));
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

      {afterSummary}

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
            includeZeroValues
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
    </div>
  );
}

function MemoryTypeSpotlight({
  icon: Icon,
  label,
  description,
  value,
  sharePercent,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  value: number;
  sharePercent: number;
  color: string;
}) {
  return (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-border/60 bg-card/95 p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--space-accent,var(--accent-9))_8%,transparent)] transition-colors hover:border-border">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-80"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
      />
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: `color-mix(in oklab, ${color} 18%, transparent)`,
            color,
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {sharePercent}%
        </span>
      </div>
      <p className="mt-4 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
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
  const { summary } = payload;
  const userCreatedTotal = summary.userCreatedTotal ?? 0;
  const memoryTotal =
    summary.summariesTotal +
    summary.transcriptsTotal +
    summary.recordingsTotal +
    userCreatedTotal;
  const typeSlices = [
    {
      label: t('memoryDashboard.summaries'),
      value: summary.summariesTotal,
      color: accentColor(0),
    },
    {
      label: t('memoryDashboard.transcripts'),
      value: summary.transcriptsTotal,
      color: accentColor(1),
    },
    {
      label: t('memoryDashboard.recordings'),
      value: summary.recordingsTotal,
      color: accentColor(2),
    },
    {
      label: t('memoryDashboard.userCreatedMemories'),
      value: userCreatedTotal,
      color: accentColor(3),
    },
  ];
  const sharePercent = (value: number) =>
    memoryTotal > 0 ? Math.round((value / memoryTotal) * 100) : 0;
  const dominantSlice =
    memoryTotal > 0
      ? typeSlices.reduce((best, item) =>
          item.value > best.value ? item : best,
        )
      : null;
  const weeklySummaryPoints = (payload.weekly ?? []).map((row) => ({
    label: row.week,
    value: row.count,
  }));
  const recentActivityPoints = [
    {
      label: t('memoryDashboard.summaries7dShort'),
      value: summary.summariesLast7d,
    },
    {
      label: t('memoryDashboard.summaries24hShort'),
      value: summary.summariesLast24h,
    },
  ];

  return (
    <div className="space-y-4">
      <StatRibbon
        items={[
          {
            label: t('memoryDashboard.totalItems'),
            value: memoryTotal,
            hint: t('memoryDashboard.totalHint', { count: memoryTotal }),
          },
          {
            label: t('memoryDashboard.summaries7d'),
            value: summary.summariesLast7d,
            hint: t('memoryDashboard.summaries24h', {
              count: summary.summariesLast24h,
            }),
          },
          {
            label: t('memoryDashboard.chatStatus'),
            value: summary.hasChat
              ? t('memoryDashboard.chatActive')
              : t('memoryDashboard.chatInactive'),
            hint: summary.hasChat
              ? t('memoryDashboard.hasChat')
              : t('memoryDashboard.noChat'),
          },
          {
            label: t('memoryDashboard.dominantType'),
            value: dominantSlice?.label ?? '—',
            hint: dominantSlice
              ? t('memoryDashboard.shareOfArchive', {
                  percent: sharePercent(dominantSlice.value),
                })
              : t('memoryDashboard.emptyArchive'),
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <OverviewChartShell
          title={t('memoryDashboard.composition')}
          subtitle={t('memoryDashboard.compositionSubtitle')}
          className="h-full"
        >
          <DonutChart
            data={typeSlices}
            centerValue={memoryTotal}
            centerLabel={t('memoryDashboard.items')}
            emptyLabel={t('memoryDashboard.noData')}
          />
        </OverviewChartShell>
        <OverviewChartShell
          title={t('memoryDashboard.byType')}
          subtitle={t('memoryDashboard.byTypeSubtitle')}
          className="h-full"
        >
          <HorizontalBarsChart
            items={typeSlices}
            emptyLabel={t('memoryDashboard.noData')}
            includeZeroValues
          />
        </OverviewChartShell>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MemoryTypeSpotlight
          icon={FileText}
          label={t('memoryDashboard.summaries')}
          description={t('memoryDashboard.summariesDesc')}
          value={summary.summariesTotal}
          sharePercent={sharePercent(summary.summariesTotal)}
          color={accentColor(0)}
        />
        <MemoryTypeSpotlight
          icon={Mic}
          label={t('memoryDashboard.transcripts')}
          description={t('memoryDashboard.transcriptsDesc')}
          value={summary.transcriptsTotal}
          sharePercent={sharePercent(summary.transcriptsTotal)}
          color={accentColor(1)}
        />
        <MemoryTypeSpotlight
          icon={Video}
          label={t('memoryDashboard.recordings')}
          description={t('memoryDashboard.recordingsDesc')}
          value={summary.recordingsTotal}
          sharePercent={sharePercent(summary.recordingsTotal)}
          color={accentColor(2)}
        />
        <MemoryTypeSpotlight
          icon={BookMarked}
          label={t('memoryDashboard.userCreatedMemories')}
          description={t('memoryDashboard.userCreatedMemoriesDesc')}
          value={userCreatedTotal}
          sharePercent={sharePercent(userCreatedTotal)}
          color={accentColor(3)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <OverviewChartShell
          title={t('memoryDashboard.summaryVelocity')}
          subtitle={t('memoryDashboard.summaryVelocitySubtitle')}
          className="h-full"
        >
          <AreaTrendChart
            points={weeklySummaryPoints}
            emptyLabel={t('memoryDashboard.noData')}
          />
        </OverviewChartShell>
        <OverviewChartShell
          title={t('memoryDashboard.recentActivity')}
          subtitle={t('memoryDashboard.recentActivitySubtitle')}
          className="h-full"
        >
          <VerticalBarsChart
            items={recentActivityPoints.map((point, index) => ({
              label: point.label,
              value: point.value,
              color: index === 0 ? accentColor(0) : SPACE_ACCENT,
            }))}
            emptyLabel={t('memoryDashboard.noRecentActivity')}
          />
        </OverviewChartShell>
      </div>
    </div>
  );
}

export function OverviewActiveSpacesDashboard({
  spaceSlug,
}: {
  spaceSlug: string;
}) {
  const locale = useLocale();
  const { getAccessToken } = useAuthentication();
  const t = useTranslations('TokenHoldingsDashboard');
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<
    'all' | 'active_paid' | 'free_trial' | 'expiring' | 'expired'
  >('all');
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

  const filteredSpaces = React.useMemo(() => {
    if (!data) return [];
    const payload = data as SpaceOverviewFlowsData;
    const nowSec = Math.floor(Date.now() / 1000);
    const in30Days = nowSec + 30 * 86_400;
    const query = search.trim().toLowerCase();

    return payload.spaces.filter((space) => {
      if (query) {
        const haystack = `${space.title} ${space.slug}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active_paid') {
        return space.classification === 'active_paid';
      }
      if (statusFilter === 'free_trial') {
        return space.classification === 'free_trial' && space.isActive;
      }
      if (statusFilter === 'expiring') {
        return (
          space.isActive &&
          space.expiryTime != null &&
          space.expiryTime > nowSec &&
          space.expiryTime <= in30Days
        );
      }
      if (statusFilter === 'expired') {
        return space.classification === 'expired_paid';
      }
      return true;
    });
  }, [data, search, statusFilter]);

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
  const summary = payload.summary;
  const totalHyphaBurned = Number.parseFloat(summary.totalHyphaBurned);
  const hyphaBurnedDisplay = Number.isFinite(totalHyphaBurned)
    ? totalHyphaBurned.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : summary.totalHyphaBurned;
  const monthly = payload.monthly.slice(-12);
  const activationBars = monthly.map((row, index) => ({
    label: row.month.slice(5),
    value: row.spacesActivated,
    color: accentColor(index),
  }));
  const contributionBars = monthly.map((row, index) => ({
    label: row.month.slice(5),
    value: Math.round(Number.parseFloat(row.totalHypha) || 0),
    color: accentColor(index + 2),
  }));
  const churnBars = monthly.map((row, index) => ({
    label: row.month.slice(5),
    value: row.spacesExpired,
    color: accentColor(index + 4),
  }));
  const classificationSlices = [
    {
      label: t('flowsDashboard.classification.active_paid'),
      value: summary.activePaidSpaces,
      color: accentColor(0),
    },
    {
      label: t('flowsDashboard.classification.free_trial'),
      value: summary.activeFreeTrialSpaces,
      color: accentColor(1),
    },
    {
      label: t('flowsDashboard.classification.expired_paid'),
      value: summary.expiredPaidSpaces,
      color: accentColor(3),
    },
  ].filter((slice) => slice.value > 0);

  const formatExpiry = (expiryTime: number | null, isActive: boolean) => {
    if (!expiryTime) return t('flowsDashboard.noExpiry');
    const date = new Date(expiryTime * 1000);
    const formatted = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
    return isActive
      ? t('flowsDashboard.activeUntil', { date: formatted })
      : t('flowsDashboard.expiredOn', { date: formatted });
  };

  const classificationLabel = (
    classification: SpaceActivationClassification,
  ) => {
    switch (classification) {
      case 'active_paid':
        return t('flowsDashboard.classification.active_paid');
      case 'free_trial':
        return t('flowsDashboard.classification.free_trial');
      case 'expired_paid':
        return t('flowsDashboard.classification.expired_paid');
      default:
        return t('flowsDashboard.classification.inactive');
    }
  };

  return (
    <div className="space-y-4">
      <StatRibbon
        items={[
          {
            label: t('flowsDashboard.totalSpaces'),
            value: summary.totalSpaces,
            hint: t('flowsDashboard.spaceStructureHint', {
              ecosystems: summary.ecosystemSpaces,
              members: summary.memberSpaces,
            }),
          },
          {
            label: t('flowsDashboard.hyphaPaidSpaces'),
            value: summary.hyphaPaidSpaces,
            hint: t('flowsDashboard.hyphaPaidSpacesHint', {
              active: summary.activePaidSpaces,
              expired: summary.expiredPaidSpaces,
            }),
          },
          {
            label: t('flowsDashboard.totalHyphaBurned'),
            value: hyphaBurnedDisplay,
          },
          {
            label: t('flowsDashboard.paymentEventsLabel'),
            value: summary.paymentEventsInRange,
          },
        ]}
      />

      <StatRibbon
        items={[
          {
            label: t('flowsDashboard.activeFreeTrial'),
            value: summary.activeFreeTrialSpaces,
          },
          {
            label: t('flowsDashboard.expiringNext30Days'),
            value: summary.expiringNext30Days,
          },
          {
            label: t('flowsDashboard.justExpired30Days'),
            value: summary.justExpired30Days,
          },
          {
            label: t('flowsDashboard.churnRate'),
            value: `${summary.churnRatePct}%`,
            hint: t('flowsDashboard.churnRateHint'),
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <OverviewChartShell
          title={t('flowsDashboard.activationByMonth')}
          subtitle={t('flowsDashboard.activationByMonthSubtitle')}
        >
          <VerticalBarsChart
            items={activationBars}
            emptyLabel={t('flowsDashboard.noData')}
          />
        </OverviewChartShell>
        <OverviewChartShell
          title={t('flowsDashboard.contributionByMonth')}
          subtitle={t('flowsDashboard.contributionByMonthSubtitle')}
        >
          <VerticalBarsChart
            items={contributionBars}
            emptyLabel={t('flowsDashboard.noData')}
          />
        </OverviewChartShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <OverviewChartShell
          title={t('flowsDashboard.churnByMonth')}
          subtitle={t('flowsDashboard.churnByMonthSubtitle')}
        >
          <VerticalBarsChart
            items={churnBars}
            emptyLabel={t('flowsDashboard.noData')}
          />
        </OverviewChartShell>
        <OverviewChartShell
          title={t('flowsDashboard.activeMix')}
          subtitle={t('flowsDashboard.activeMixSubtitle')}
        >
          <DonutChart
            data={classificationSlices}
            centerValue={summary.hyphaPaidSpaces}
            centerLabel={t('flowsDashboard.hyphaPaidSpaces')}
            emptyLabel={t('flowsDashboard.noData')}
          />
        </OverviewChartShell>
      </div>

      <OverviewChartShell
        title={t('flowsDashboard.registryTitle')}
        subtitle={t('flowsDashboard.registrySubtitle', {
          shown: filteredSpaces.length,
          total: payload.spaces.length,
        })}
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('flowsDashboard.searchPlaceholder')}
            className="max-w-md"
          />
          <div className="flex flex-wrap gap-2">
            {(
              [
                'all',
                'active_paid',
                'free_trial',
                'expiring',
                'expired',
              ] as const
            ).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  statusFilter === filter
                    ? 'border-[color-mix(in_oklab,var(--space-accent,var(--accent-9))_40%,var(--border))] bg-[color-mix(in_oklab,var(--space-accent,var(--accent-9))_14%,transparent)] text-foreground'
                    : 'border-border/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`flowsDashboard.filters.${filter}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">
                  {t('flowsDashboard.table.space')}
                </th>
                <th className="px-3 py-2.5">
                  {t('flowsDashboard.table.classification')}
                </th>
                <th className="px-3 py-2.5">
                  {t('flowsDashboard.table.status')}
                </th>
                <th className="px-3 py-2.5">
                  {t('flowsDashboard.table.activeUntil')}
                </th>
                <th className="px-3 py-2.5 text-right">
                  {t('flowsDashboard.table.hyphaPaid')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSpaces.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    {t('flowsDashboard.noMatches')}
                  </td>
                </tr>
              ) : (
                filteredSpaces.map((space) => (
                  <tr
                    key={space.spaceId}
                    className="border-t border-border/50 hover:bg-muted/20"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-foreground">
                        {space.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {space.slug}
                        {space.isEcosystem
                          ? ` · ${t('flowsDashboard.ecosystemBadge')}`
                          : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="border-border/60">
                        {classificationLabel(space.classification)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className={
                          space.isActive
                            ? 'border-[color-mix(in_oklab,var(--color-success-9,var(--success-9))_35%,var(--border))] text-[var(--color-success-11,var(--success-11))]'
                            : 'border-border/60 text-muted-foreground'
                        }
                      >
                        {space.isActive
                          ? t('flowsDashboard.active')
                          : t('flowsDashboard.expired')}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {formatExpiry(space.expiryTime, space.isActive)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                      {Number.parseFloat(space.totalHyphaPaid).toLocaleString(
                        locale,
                        { maximumFractionDigits: 2 },
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </OverviewChartShell>
    </div>
  );
}

/** @deprecated Use OverviewActiveSpacesDashboard */
export const OverviewFlowsDashboard = OverviewActiveSpacesDashboard;

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
