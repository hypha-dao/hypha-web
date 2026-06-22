'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@hypha-platform/ui';
import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import { ENERGY_PALETTE, LineAreaChart, type ChartSeries } from './charts';
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

  const sourceLabels = React.useMemo(
    () =>
      (data.sources ?? []).map((s, i) =>
        prettySourceLabel(s.sourceLabel, i, s.sourceType),
      ),
    [data.sources],
  );

  const labels = React.useMemo(() => timeframeLabels(timeframe), [timeframe]);

  const { perSource, consumption } = React.useMemo(
    () =>
      buildProductionSeries(
        sourceLabels.length ? sourceLabels : ['Community grid'],
        timeframe,
      ),
    [sourceLabels, timeframe],
  );

  const totalProduced = perSource.reduce((acc, s) => acc + sum(s.values), 0);
  const totalConsumed = sum(consumption);
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-1 text-neutral-11">
          Placeholder telemetry — production &amp; consumption readings will
          stream from the metering API.
        </p>
        <TimeframeToggle value={timeframe} onChange={setTimeframe} />
      </div>

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
          value={`${net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString()} kWh`}
          accent={net >= 0 ? ENERGY_PALETTE[1] : ENERGY_PALETTE[4]}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Production vs consumption</CardTitle>
        </CardHeader>
        <CardContent>
          <LineAreaChart series={productionVsConsumption} labels={labels} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Production by source</CardTitle>
        </CardHeader>
        <CardContent>
          <LineAreaChart series={bySource} labels={labels} fill={false} />
        </CardContent>
      </Card>
    </div>
  );
};
