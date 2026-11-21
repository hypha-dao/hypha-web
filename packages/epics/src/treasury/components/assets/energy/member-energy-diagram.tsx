'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMe } from '@hypha-platform/core/client';
import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import { useSpaceEnergy } from '../../../hooks/use-space-energy';
import { useSpaceEnergyTelemetry } from '../../../hooks/use-space-energy-telemetry';
import { LineChart, type ChartSeries } from './charts';
import { PRODUCTION_DEFAULT_TIMEFRAME } from './energy-constants';
import {
  buildGridFlowSeries,
  buildProductionSeries,
  timeframeLabels,
  type Timeframe,
} from './dummy-data';
import { TimeframeToggle } from './timeframe-toggle';
import {
  EnergyChartSkeleton,
  EnergySectionSkeleton,
} from './loading-skeletons';

const SOLAR = '#3cae4a';
const SHARED = '#8a918c';
const COMMUNITY = '#3b6cb5';
const GRID = '#b0b0b0';

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

const formatEnergy = (value: number, locale: string) =>
  value.toLocaleString(locale, {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 1,
  });

const bucketSum = (series: { values: number[] }[]) => {
  const length = Math.max(0, ...series.map((item) => item.values.length));
  return Array.from({ length }, (_, index) =>
    series.reduce((total, item) => total + (item.values[index] ?? 0), 0),
  );
};

function homeTotals(
  data: SpaceEnergyResponse,
  address: string | undefined,
  production: { values: number[] }[],
  consumptionByMeter: { meterId: number; valuesKwh: number[] }[],
  communityUse: number[],
) {
  const member = address
    ? data.memberDetails?.find(
        (detail) => detail.address.toLowerCase() === address.toLowerCase(),
      )
    : undefined;
  const ownership = new Map(
    (member?.ownerships ?? []).map((item) => [
      item.sourceId,
      item.ownershipBps,
    ]),
  );
  const make = production.map((source, index) => {
    const registered = data.sources?.[index];
    const bps = registered ? ownership.get(registered.sourceId) ?? 0 : 0;
    return (source.values ?? []).map((value) => (value * bps) / 10000);
  });
  const made = bucketSum(make.map((values) => ({ values })));
  const meterIds = new Set(member?.deviceIds ?? []);
  const usedBuckets = consumptionByMeter.filter((meter) =>
    meterIds.has(meter.meterId),
  );
  const used = bucketSum(
    usedBuckets.map((meter) => ({ values: meter.valuesKwh })),
  );
  const hasMake = made.some((value) => value > 0);
  const hasUse = used.some((value) => value > 0);
  return {
    makeIsHome: hasMake,
    useIsHome: hasUse,
    paired: hasMake && hasUse,
    make: hasMake ? made : bucketSum(production),
    use: hasUse ? used : communityUse,
  };
}

function EnergyFigure({
  label,
  value,
  unit,
  caption,
  size = 'large',
}: {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  size?: 'large' | 'small';
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={
          size === 'small'
            ? 'mt-1 text-5 leading-none'
            : 'mt-1 text-7 leading-none sm:text-8'
        }
        style={{ color: SOLAR, fontFamily: 'var(--font-family-heading)' }}
      >
        {value}
        {unit ? (
          <span className="ml-1 text-2 font-normal text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </p>
      {caption ? (
        <p className="mt-2 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

export function MemberEnergyDiagram({ spaceSlug }: { spaceSlug: string }) {
  const locale = useLocale();
  const t = useTranslations('Energy.memberDiagram');
  const tProduction = useTranslations('Energy.productionConsumption');
  const { person } = useMe();
  const { data, isLoading } = useSpaceEnergy(spaceSlug);
  const [timeframe, setTimeframe] = React.useState<Timeframe>(
    PRODUCTION_DEFAULT_TIMEFRAME,
  );
  const {
    data: telemetry,
    isLoading: telemetryLoading,
    error: telemetryError,
  } = useSpaceEnergyTelemetry(timeframe, spaceSlug);

  const sourceLabels = React.useMemo(
    () =>
      (data?.sources ?? []).map(
        (source, index) =>
          source.sourceDisplayName || source.sourceLabel || `${index}`,
      ),
    [data?.sources],
  );

  const dummy = React.useMemo(
    () =>
      buildProductionSeries(
        sourceLabels.length ? sourceLabels : [tProduction('communityGrid')],
        timeframe,
      ),
    [sourceLabels, tProduction, timeframe],
  );
  const live = Boolean(
    telemetry?.enabled &&
      telemetry.configured &&
      !telemetryError &&
      telemetry.dataFrom,
  );
  const labels = live ? telemetry!.labels : timeframeLabels(timeframe, locale);
  const production = live
    ? telemetry!.productionBySource.map((source) => ({
        values: source.valuesKwh,
      }))
    : dummy.perSource;
  const communityUse = live ? telemetry!.consumptionKwh : dummy.consumption;
  const dummyGrid = React.useMemo(
    () => buildGridFlowSeries(dummy.perSource, dummy.consumption),
    [dummy.consumption, dummy.perSource],
  );
  const gridImport = live ? telemetry!.gridImportKwh : dummyGrid.gridImport;
  const gridExport = live ? telemetry!.gridExportKwh : dummyGrid.gridExport;
  const communityMake = bucketSum(production);
  const home = homeTotals(
    data ?? { enabled: false },
    live ? person?.address : undefined,
    production,
    live ? telemetry!.consumptionByMeter : [],
    communityUse,
  );
  const youMake = sum(home.make);
  const youUse = sum(home.use);
  const youShare = home.paired
    ? Math.max(0, youMake - youUse)
    : sum(gridExport);
  const communityMade = live
    ? telemetry!.totals.producedKwh
    : sum(communityMake);
  const communityUsed = live
    ? telemetry!.totals.consumedKwh
    : sum(communityUse);
  const batteryKwh = sum(
    (data?.sources ?? []).flatMap((source, index) =>
      source.sourceType.toUpperCase() === 'BATTERY'
        ? production[index]?.values ?? []
        : [],
    ),
  );
  const batteryShare =
    communityMade > 0 ? Math.round((batteryKwh / communityMade) * 100) : 0;
  const exportedShare =
    communityMade > 0 ? Math.round((sum(gridExport) / communityMade) * 100) : 0;
  const meterPercent = batteryKwh > 0 ? batteryShare : exportedShare;

  if (!isLoading && (!data?.enabled || !data.overview)) return null;
  if (isLoading || !data?.overview) return <EnergySectionSkeleton />;

  const series: ChartSeries[] = [
    {
      key: 'solar',
      label: t('yourSolar'),
      color: SOLAR,
      values: communityMake,
      dots: true,
    },
    {
      key: 'shared',
      label: t('shared'),
      color: SHARED,
      values: gridExport,
      dash: '1.5 3',
    },
    {
      key: 'community',
      label: t('communityUse'),
      color: COMMUNITY,
      values: communityUse,
      dash: '7 4',
    },
    {
      key: 'grid',
      label: t('grid'),
      color: GRID,
      values: gridImport,
      dash: '1 2.5',
    },
  ];
  const titleKey =
    timeframe === '30d'
      ? 'title30d'
      : timeframe === '90d'
      ? 'title90d'
      : timeframe === '12m'
      ? 'title12m'
      : 'title7d';

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            {t('eyebrow')}
          </p>
          <h1
            className="mt-2 text-6 text-foreground sm:text-7"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {t(titleKey)}
          </h1>
        </div>
        <TimeframeToggle value={timeframe} onChange={setTimeframe} />
      </div>

      <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            {t('balance')}
          </p>
          {live ? (
            <p
              className="text-[11px] tracking-[0.14em] uppercase"
              style={{ color: SOLAR }}
            >
              {t('live')}
            </p>
          ) : (
            <p className="text-1 text-muted-foreground">
              {telemetryLoading
                ? tProduction('loadingTelemetry')
                : telemetryError
                ? tProduction('telemetryError')
                : !telemetry?.configured
                ? tProduction('dbNotConfigured')
                : telemetry?.enabled && !telemetry?.dataFrom
                ? tProduction('noReadings')
                : tProduction('placeholderTelemetry')}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <EnergyFigure
            label={t('youMake')}
            value={formatEnergy(youMake, locale)}
            unit={t('kwhUnit')}
            caption={home.makeIsHome ? t('fromYourShare') : t('madeHere')}
          />
          <EnergyFigure
            label={t('youUse')}
            value={formatEnergy(youUse, locale)}
            unit={t('kwhUnit')}
            caption={home.useIsHome ? t('usedAtHome') : t('usedHere')}
          />
          <EnergyFigure
            label={t('youShare')}
            value={formatEnergy(youShare, locale)}
            unit={t('kwhUnit')}
            caption={home.paired ? t('passedOn') : t('passedOnCommunity')}
          />
        </div>

        <div className="mt-6">
          {telemetryLoading ? (
            <EnergyChartSkeleton height={280} bars={12} />
          ) : (
            <LineChart
              series={series}
              labels={labels}
              height={340}
              valueSuffix={` ${t('kwhUnit')}`}
              bands={[t('zoneRoof'), t('zoneBattery'), t('zoneNeighbours')]}
            />
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-3">
          <EnergyFigure
            label={t('communityMakes')}
            value={formatEnergy(communityMade, locale)}
            unit={t('kwhUnit')}
            caption={t('overThisPeriod')}
            size="small"
          />
          <EnergyFigure
            label={t('communityUses')}
            value={formatEnergy(communityUsed, locale)}
            unit={t('kwhUnit')}
            caption={t('overThisPeriod')}
            size="small"
          />
          <EnergyFigure
            label={batteryKwh > 0 ? t('battery') : t('shared')}
            value={`${meterPercent}%`}
            caption={t('overThisPeriod')}
            size="small"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-3 text-foreground"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {batteryKwh > 0 ? t('neighbourhoodBattery') : t('sharedOnward')}
            </p>
            <p className="mt-1 text-1 text-muted-foreground">
              {t('youAdded', {
                value: formatEnergy(youShare, locale),
              })}
            </p>
          </div>
          <p
            className="text-5"
            style={{ color: SOLAR, fontFamily: 'var(--font-family-heading)' }}
          >
            {meterPercent}%
          </p>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(0, Math.min(100, meterPercent))}%`,
              backgroundColor: SOLAR,
            }}
          />
        </div>
      </div>
    </section>
  );
}
