'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@hypha-platform/ui';
import { CoinsIcon } from 'lucide-react';
import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import { BarChart, ENERGY_PALETTE, type ChartSeries } from './charts';
import {
  buildSettlementSeries,
  dummySettledMicro,
  isEurcDummyCommunity,
  timeframeLabels,
  type Timeframe,
} from './dummy-data';
import { TimeframeToggle } from './timeframe-toggle';
import { StatCard } from './shared';
import { formatStablecoinMicro } from './format';
import { useCommunitySlug } from './use-community-slug';

export const SettlementTab = ({ data }: { data: SpaceEnergyResponse }) => {
  const [timeframe, setTimeframe] = React.useState<Timeframe>('30d');
  const slug = useCommunitySlug();
  const dummyEurc = isEurcDummyCommunity(slug);

  const labels = React.useMemo(() => timeframeLabels(timeframe), [timeframe]);
  const settlementSeries = React.useMemo(
    () => buildSettlementSeries(timeframe),
    [timeframe],
  );

  const totalSettledEurc = React.useMemo(() => {
    if (dummyEurc) {
      const total = (data.memberDetails ?? []).reduce(
        (acc, m) => acc + BigInt(dummySettledMicro(m.address)),
        0n,
      );
      return formatStablecoinMicro(total.toString());
    }
    return formatStablecoinMicro(data.overview?.contractStablecoinBalance);
  }, [dummyEurc, data.memberDetails, data.overview?.contractStablecoinBalance]);

  const settledKwh = settlementSeries.reduce((acc, d) => acc + d.value, 0);

  const chartSeries: ChartSeries[] = [
    {
      key: 'settled',
      label: 'Settled energy',
      color: ENERGY_PALETTE[3]!,
      values: settlementSeries.map((d) => d.value),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="Total settled (EURC)"
          value={totalSettledEurc}
          hint="Stablecoin reconciled through the PPA contract"
          accent={ENERGY_PALETTE[1]}
          icon={<CoinsIcon size={16} />}
        />
        <StatCard
          label="Settled energy"
          value={`${settledKwh.toLocaleString()} kWh`}
          hint={`Across the selected ${timeframe.toUpperCase()} window`}
          accent={ENERGY_PALETTE[3]}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Settled energy over time</CardTitle>
            <TimeframeToggle value={timeframe} onChange={setTimeframe} />
          </div>
        </CardHeader>
        <CardContent>
          <BarChart
            series={chartSeries}
            labels={labels}
            valueSuffix=" kWh"
            showLegend={false}
          />
          <p className="mt-2 text-1 text-neutral-11">
            kWh reconciled per period (placeholder telemetry)
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
