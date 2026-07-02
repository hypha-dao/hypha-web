'use client';

import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { Skeleton } from '@hypha-platform/ui';
import { PersonAvatar } from '../../../../people/components/person-avatar';
import { useSpaceEnergyTelemetry } from '../../../hooks/use-space-energy-telemetry';
import type { EnergyPerson } from './use-energy-people';
import { personDisplayName, shortAddr } from './format';
import { BarChart, ENERGY_PALETTE, type ChartSeries } from './charts';
import {
  buildMemberConsumptionSeries,
  granularityConfig,
  granularityLabels,
  type Granularity,
} from './granularity';
import { GranularityToggle } from './granularity-toggle';

/**
 * Rendered only while the card is expanded so the telemetry request fires
 * lazily. SWR dedupes across cards sharing the same period.
 */
const ConsumerConsumptionChart = ({
  address,
  deviceIds,
}: {
  address: string;
  deviceIds: number[] | null;
}) => {
  const [granularity, setGranularity] = React.useState<Granularity>('daily');
  const cfg = granularityConfig(granularity);
  const {
    data: telemetry,
    isLoading,
    error,
  } = useSpaceEnergyTelemetry(cfg.period);

  const useLiveTelemetry = Boolean(
    telemetry?.enabled && telemetry.configured && !error && telemetry.dataFrom,
  );

  const { labels, values, isPlaceholder } = React.useMemo(() => {
    if (useLiveTelemetry && deviceIds) {
      const meterSet = new Set(deviceIds);
      const matched = (telemetry!.consumptionByMeter ?? []).filter((series) =>
        meterSet.has(series.meterId),
      );
      const values = telemetry!.labels.map((_, i) =>
        matched.reduce((acc, series) => acc + (series.valuesKwh[i] ?? 0), 0),
      );
      return { labels: telemetry!.labels, values, isPlaceholder: false };
    }
    return {
      labels: granularityLabels(granularity),
      values: buildMemberConsumptionSeries(address, granularity),
      isPlaceholder: true,
    };
  }, [useLiveTelemetry, telemetry, deviceIds, address, granularity]);

  const total = values.reduce((a, b) => a + b, 0);

  // Individual households move small amounts per bucket; render in Wh when
  // the whole series fits under 10 kWh so bars and ticks stay readable.
  const useWh = values.every((v) => v < 10);
  const unit = useWh ? 'Wh' : 'kWh';
  const displayValues = useWh
    ? values.map((v) => Math.round(v * 1000))
    : values;
  const displayTotal = useWh ? Math.round(total * 1000) : Math.round(total);

  const series: ChartSeries[] = [
    {
      key: 'consumption',
      label: 'Consumption',
      color: ENERGY_PALETTE[2]!,
      values: displayValues,
    },
  ];

  return (
    <div className="flex flex-col gap-3 border-t border-border px-3 pb-3 pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-1 text-neutral-11">
          {displayTotal.toLocaleString()} {unit} over this window
        </p>
        <GranularityToggle value={granularity} onChange={setGranularity} />
      </div>
      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : (
        <BarChart
          series={series}
          labels={labels}
          mode="grouped"
          height={200}
          valueSuffix={` ${unit}`}
          showLegend={false}
        />
      )}
      <p className="text-1 text-neutral-11">
        {isPlaceholder
          ? 'Placeholder consumption — live metering data is not connected for this member yet.'
          : `Live interval data across ${deviceIds?.length ?? 0} meter${
              (deviceIds?.length ?? 0) === 1 ? '' : 's'
            }.`}
      </p>
    </div>
  );
};

/**
 * Consumer row on the Overview tab. Click to expand and see the member's
 * individual consumption as a daily / weekly / monthly bar chart.
 */
export const ConsumerConsumptionCard = ({
  address,
  person,
  isLoading,
  deviceIds,
}: {
  address: string;
  person?: EnergyPerson | null;
  isLoading?: boolean;
  deviceIds: number[] | null;
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const name = personDisplayName(person) ?? shortAddr(address);

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-background-2 transition-shadow',
        // Stretch across the grid while expanded so the chart gets full width.
        expanded && 'col-span-full shadow-md',
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 p-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <PersonAvatar
          avatarSrc={person?.avatarUrl ?? undefined}
          userName={personDisplayName(person) ?? undefined}
          size="md"
          shape="circle"
          isLoading={isLoading}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{name}</p>
          <p className="truncate text-1 text-neutral-11">
            {person?.nickname ? `@${person.nickname}` : shortAddr(address)}
          </p>
        </div>
        <ChevronDownIcon
          size={16}
          className={cn(
            'shrink-0 text-neutral-11 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {expanded ? (
        <ConsumerConsumptionChart address={address} deviceIds={deviceIds} />
      ) : null}
    </div>
  );
};
