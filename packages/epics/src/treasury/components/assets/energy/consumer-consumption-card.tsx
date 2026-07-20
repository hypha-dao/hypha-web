'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../../../people/components/person-avatar';
import { useSpaceEnergyTelemetry } from '../../../hooks/use-space-energy-telemetry';
import { shortAddr } from './format';
import { BarChart, ENERGY_PALETTE, type ChartSeries } from './charts';
import {
  buildMemberConsumptionSeries,
  granularityConfig,
  granularityLabels,
  type Granularity,
} from './granularity';
import { GranularityToggle } from './granularity-toggle';
import { EnergyChartSkeleton, EnergyTextSkeleton } from './loading-skeletons';

const ConsumerConsumptionChart = ({
  address,
  deviceIds,
}: {
  address: string;
  deviceIds: number[] | null;
}) => {
  const locale = useLocale();
  const t = useTranslations('Energy.consumerCard');
  const tShared = useTranslations('Energy.shared');
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
      labels: granularityLabels(granularity, locale),
      values: buildMemberConsumptionSeries(address, granularity),
      isPlaceholder: true,
    };
  }, [useLiveTelemetry, telemetry, deviceIds, address, granularity, locale]);

  const total = values.reduce((a, b) => a + b, 0);

  const useWh = values.every((v) => v < 10);
  const unit = useWh ? tShared('wh') : tShared('kwh');
  const displayValues = useWh
    ? values.map((v) => Math.round(v * 1000))
    : values;
  const displayTotal = useWh ? Math.round(total * 1000) : Math.round(total);

  const series: ChartSeries[] = [
    {
      key: 'consumption',
      label: t('consumption'),
      color: ENERGY_PALETTE[2]!,
      values: displayValues,
    },
  ];

  return (
    <div className="flex flex-col gap-3 border-t border-border px-3 pb-3 pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {isLoading ? (
          <EnergyTextSkeleton className="w-40" />
        ) : (
          <p className="text-1 text-neutral-11">
            {tShared('overWindow', {
              total: displayTotal.toLocaleString(locale),
              unit,
            })}
          </p>
        )}
        <GranularityToggle value={granularity} onChange={setGranularity} />
      </div>
      {isLoading ? (
        <EnergyChartSkeleton height={200} bars={10} />
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
      {isLoading ? (
        <EnergyTextSkeleton className="w-56" />
      ) : (
        <p className="text-1 text-neutral-11">
          {isPlaceholder
            ? t('placeholderConsumption')
            : tShared('liveMeterData', { count: deviceIds?.length ?? 0 })}
        </p>
      )}
    </div>
  );
};

export const ConsumerConsumptionCard = ({
  address,
  displayName,
  avatarUrl,
  subtitle,
  isLoading,
  deviceIds,
}: {
  address: string;
  displayName: string;
  avatarUrl?: string;
  subtitle?: string;
  isLoading?: boolean;
  deviceIds: number[] | null;
}) => {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-background-2 transition-shadow',
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
          avatarSrc={avatarUrl}
          userName={displayName}
          size="md"
          shape="circle"
          isLoading={isLoading}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{displayName}</p>
          <p className="truncate text-1 text-neutral-11">
            {subtitle ?? shortAddr(address)}
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
