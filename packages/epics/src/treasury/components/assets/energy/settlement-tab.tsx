'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@hypha-platform/ui';
import { CoinsIcon } from 'lucide-react';
import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import { BarChart, ENERGY_PALETTE } from './charts';
import { buildSettlementSeries, type Timeframe } from './dummy-data';
import { TimeframeToggle } from './timeframe-toggle';
import { StatCard } from './shared';
import { formatStablecoinMicro, formatSignedInternal } from './format';

export const SettlementTab = ({ data }: { data: SpaceEnergyResponse }) => {
  const [timeframe, setTimeframe] = React.useState<Timeframe>('30d');
  const series = React.useMemo(
    () => buildSettlementSeries(timeframe),
    [timeframe],
  );

  const totalSettledUsdc = formatStablecoinMicro(
    data.overview?.contractStablecoinBalance,
  );
  const settledKwh = series.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total settled (USDC)"
          value={totalSettledUsdc}
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
        <StatCard
          label="Settled balance (internal)"
          value={formatSignedInternal(data.overview?.settledBalance)}
          hint="On-chain internal settlement units"
          accent={ENERGY_PALETTE[5]}
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
            data={series}
            color={ENERGY_PALETTE[3]}
            unit="kWh reconciled per period (placeholder telemetry)"
          />
        </CardContent>
      </Card>
    </div>
  );
};
