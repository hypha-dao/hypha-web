'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@hypha-platform/ui';
import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import { useSpaceEnergyTelemetry } from '../../../hooks/use-space-energy-telemetry';
import { BarChart, ENERGY_PALETTE, type ChartSeries } from './charts';
import {
  buildProductionSeries,
  timeframeLabels,
  type Timeframe,
} from './dummy-data';
import { TimeframeToggle } from './timeframe-toggle';
import { StatCard } from './shared';
import { prettySourceLabel } from './format';

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

export const ProductionConsumptionTab = ({
  data,
}: {
  data: SpaceEnergyResponse;
}) => {
  const [timeframe, setTimeframe] = React.useState<Timeframe>('30d');
  const {
    data: telemetry,
    isLoading: telemetryLoading,
    error: telemetryError,
  } = useSpaceEnergyTelemetry(timeframe);

  const sourceLabels = React.useMemo(
    () =>
      (data.sources ?? []).map((s, i) =>
        prettySourceLabel(s.sourceLabel, i, s.sourceType),
      ),
    [data.sources],
  );

  const dummy = React.useMemo(
    () =>
      buildProductionSeries(
        sourceLabels.length ? sourceLabels : ['Community grid'],
        timeframe,
      ),
    [sourceLabels, timeframe],
  );

  const useLiveTelemetry = Boolean(
    telemetry?.enabled &&
      telemetry.configured &&
      !telemetryError &&
      telemetry.dataFrom,
  );

  const labels = useLiveTelemetry
    ? telemetry!.labels
    : timeframeLabels(timeframe);
  const perSource = useLiveTelemetry
    ? telemetry!.productionBySource.map((s) => ({
        label: s.label,
        values: s.valuesKwh,
      }))
    : dummy.perSource;
  const consumption = useLiveTelemetry
    ? telemetry!.consumptionKwh
    : dummy.consumption;

  const totalProduced = useLiveTelemetry
    ? telemetry!.totals.producedKwh
    : perSource.reduce((acc, s) => acc + sum(s.values), 0);
  const totalConsumed = useLiveTelemetry
    ? telemetry!.totals.consumedKwh
    : sum(consumption);
  const net = totalProduced - totalConsumed;

  const productionVsConsumption: ChartSeries[] = [
    {
      key: 'produced',
      label: 'Produced',
      color: ENERGY_PALETTE[0]!,
      values: labels.map((_, i) =>
        perSource.reduce((acc, s) => acc + (s.values[i] ?? 0), 0),
      ),
    },
    {
      key: 'consumed',
      label: 'Consumed',
      color: ENERGY_PALETTE[2]!,
      values: consumption,
    },
  ];

  const bySource: ChartSeries[] = perSource.map((s, i) => ({
    key: s.label,
    label: s.label,
    color: ENERGY_PALETTE[i % ENERGY_PALETTE.length]!,
    values: s.values,
  }));

  const statusMessage = React.useMemo(() => {
    if (telemetryLoading) return 'Loading interval telemetry…';
    if (telemetryError) {
      return 'Could not load telemetry — showing placeholder charts.';
    }
    if (!telemetry?.configured) {
      return 'Azure energy DB is not configured (ENERGY_DB_* env vars). Showing placeholder charts.';
    }
    if (useLiveTelemetry && telemetry?.dataFrom && telemetry?.dataTo) {
      const from = new Date(telemetry.dataFrom).toLocaleDateString();
      const to = new Date(telemetry.dataTo).toLocaleDateString();
      return `Live 15-minute interval data (${from} – ${to}). Sparse buckets show zero until more history accumulates.`;
    }
    if (telemetry?.enabled && !telemetry?.dataFrom) {
      return 'No interval readings yet for this community — showing placeholder charts.';
    }
    return 'Placeholder telemetry — production & consumption readings will stream from the metering API.';
  }, [
    telemetry?.configured,
    telemetry?.dataFrom,
    telemetry?.dataTo,
    telemetry?.enabled,
    telemetryError,
    telemetryLoading,
    useLiveTelemetry,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-1 text-neutral-11">{statusMessage}</p>
        <TimeframeToggle value={timeframe} onChange={setTimeframe} />
      </div>

      {telemetryLoading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Total produced"
            value={`${totalProduced.toLocaleString()} kWh`}
            accent={ENERGY_PALETTE[0]}
          />
          <StatCard
            label="Total consumed"
            value={`${totalConsumed.toLocaleString()} kWh`}
            accent={ENERGY_PALETTE[2]}
          />
          <StatCard
            label="Net surplus"
            value={`${net >= 0 ? '+' : '−'}${Math.abs(
              net,
            ).toLocaleString()} kWh`}
            accent={net >= 0 ? ENERGY_PALETTE[1] : ENERGY_PALETTE[4]}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Production vs consumption</CardTitle>
        </CardHeader>
        <CardContent>
          {telemetryLoading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <BarChart
              series={productionVsConsumption}
              labels={labels}
              mode="grouped"
              valueSuffix=" kWh"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Production by source</CardTitle>
        </CardHeader>
        <CardContent>
          {telemetryLoading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <BarChart
              series={bySource}
              labels={labels}
              mode="stacked"
              valueSuffix=" kWh"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
