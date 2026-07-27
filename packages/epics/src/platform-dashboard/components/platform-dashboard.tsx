'use client';

import * as React from 'react';
import type { PlatformDashboardData } from '@hypha-platform/core/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Button,
} from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import Link from 'next/link';
import { PlatformDashboardGate } from './platform-dashboard-gate';

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-3 font-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-6 font-semibold">{value}</p>
        {hint ? (
          <p className="mt-1 text-2 text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BarChart({
  title,
  items,
  valueKey,
  labelKey,
}: {
  title: string;
  items: Array<Record<string, string | number>>;
  valueKey: string;
  labelKey: string;
}) {
  const max = Math.max(...items.map((item) => Number(item[valueKey] ?? 0)), 1);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-3 text-muted-foreground">No data yet.</p>
        ) : (
          items.map((item) => {
            const value = Number(item[valueKey] ?? 0);
            const label = String(item[labelKey] ?? '');
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-2">
                  <span>{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function PlatformDashboardContent({
  fetchDashboard,
}: {
  fetchDashboard: () => Promise<Response>;
}) {
  const [data, setData] = React.useState<PlatformDashboardData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchDashboard();
      if (!response.ok) {
        throw new Error(`Failed to load dashboard (${response.status})`);
      }
      setData((await response.json()) as PlatformDashboardData);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load dashboard',
      );
    } finally {
      setIsLoading(false);
    }
  }, [fetchDashboard]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-destructive">{error ?? 'Dashboard unavailable'}</p>
        <Button onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  const payingSummary = data.payingSpaces.summary;
  const topAssetSpaces = data.assets.spaces.slice(0, 12);
  const topSignalSpaces = data.signals.bySpace.slice(0, 10);
  const topMemorySpaces = data.spaceMemory.bySpace.summaries.slice(0, 10);

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-7 font-semibold">Hypha Platform Dashboard</h1>
          <p className="text-3 text-muted-foreground">
            Updated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="HYPHA-paid spaces"
          value={payingSummary.hyphaPaidSpaces}
          hint={`${payingSummary.activePaidSpaces} active · ${payingSummary.expiredPaidSpaces} expired`}
        />
        <MetricCard
          label="Total platform balance"
          value={formatCurrencyValue(data.assets.totalBalanceUsd)}
          hint={`${data.assets.spaceCount} spaces tracked`}
        />
        <MetricCard
          label="Signals"
          value={data.signals.summary.totalSignals}
          hint={`${data.signals.summary.createdLast7d} created in 7d`}
        />
        <MetricCard
          label="Space memory items"
          value={
            data.spaceMemory.summary.summariesTotal +
            data.spaceMemory.summary.transcriptsTotal +
            data.spaceMemory.summary.recordingsTotal
          }
          hint={`${data.spaceMemory.summary.spacesWithChat} spaces with chat`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <BarChart
          title="HYPHA activate-space payments by month"
          items={data.payingSpaces.monthly.map((bucket) => ({
            label: bucket.month,
            value: bucket.spacesActivated,
          }))}
          labelKey="label"
          valueKey="value"
        />
        <Card>
          <CardHeader>
            <CardTitle>Paying spaces breakdown</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="Total HYPHA burned"
              value={Number(payingSummary.totalHyphaBurned).toLocaleString(
                undefined,
                {
                  maximumFractionDigits: 0,
                },
              )}
            />
            <MetricCard
              label="Free trial only"
              value={payingSummary.freeTrialOnly}
            />
            <MetricCard
              label="Payment events (365d)"
              value={payingSummary.paymentEventsInRange}
            />
            <MetricCard
              label="Tracked spaces"
              value={payingSummary.totalSpaces}
            />
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-5 font-semibold">Assets by space</h2>
          <p className="text-3 text-muted-foreground">
            Total $ {formatCurrencyValue(data.assets.totalBalanceUsd)}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {topAssetSpaces.map((space) => (
            <Card key={space.slug}>
              <CardHeader className="pb-2">
                <CardTitle className="text-4">
                  <Link
                    href={`/en/dho/${space.slug}/treasury`}
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
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <BarChart
          title="Signals by type"
          items={data.signals.byType.map((row) => ({
            label: row.type,
            value: row.count,
          }))}
          labelKey="label"
          valueKey="value"
        />
        <BarChart
          title="Signals by priority"
          items={data.signals.byPriority.map((row) => ({
            label: row.priority,
            value: row.count,
          }))}
          labelKey="label"
          valueKey="value"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <BarChart
          title="Top spaces by signals"
          items={topSignalSpaces.map((row) => ({
            label: row.title,
            value: row.count,
          }))}
          labelKey="label"
          valueKey="value"
        />
        <Card>
          <CardHeader>
            <CardTitle>Signal orchestrator</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="Queue pending"
              value={data.signals.orchestrator.queue_pending}
            />
            <MetricCard
              label="Queue failed"
              value={data.signals.orchestrator.queue_failed}
            />
            <MetricCard
              label="Signals emitted (24h)"
              value={data.signals.orchestrator.signals_emitted_last_24h}
            />
            <MetricCard
              label="Relays emitted (24h)"
              value={data.signals.orchestrator.relays_emitted_last_24h}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <BarChart
          title="Space memory summaries by space"
          items={topMemorySpaces.map((row) => ({
            label: row.title,
            value: row.count,
          }))}
          labelKey="label"
          valueKey="value"
        />
        <Card>
          <CardHeader>
            <CardTitle>Space memory totals</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="Summaries"
              value={data.spaceMemory.summary.summariesTotal}
              hint={`${data.spaceMemory.summary.summariesLast24h} in 24h`}
            />
            <MetricCard
              label="Transcripts"
              value={data.spaceMemory.summary.transcriptsTotal}
            />
            <MetricCard
              label="Recordings"
              value={data.spaceMemory.summary.recordingsTotal}
            />
            <MetricCard
              label="Summaries (7d)"
              value={data.spaceMemory.summary.summariesLast7d}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export function PlatformDashboard() {
  return (
    <PlatformDashboardGate>
      {(fetchDashboard) => (
        <PlatformDashboardContent fetchDashboard={fetchDashboard} />
      )}
    </PlatformDashboardGate>
  );
}
