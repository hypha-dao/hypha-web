'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
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
  buildGridFlowSeries,
  timeframeLabels,
  type Timeframe,
} from './dummy-data';
import { TimeframeToggle } from './timeframe-toggle';
import { StatCard } from './shared';
import { sourceCardLabel } from './format';

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

export const ProductionConsumptionTab = ({
  data,
}: {
  data: SpaceEnergyResponse;
}) => {
  const locale = useLocale();
  const t = useTranslations('Energy.productionConsumption');
  const tShared = useTranslations('Energy.shared');
  const [timeframe, setTimeframe] = React.useState<Timeframe>('30d');
  const {
    data: telemetry,
    isLoading: telemetryLoading,
    error: telemetryError,
  } = useSpaceEnergyTelemetry(timeframe);

  const sourceFallback = tShared('source');

  const sourceLabels = React.useMemo(() => {
    const sourceTypeLabels = {
      SOLAR: tShared('sourceTypeSolar'),
      BATTERY: tShared('sourceTypeBattery'),
    };
    return (data.sources ?? []).map((s, i) =>
      sourceCardLabel(s, i, sourceFallback, sourceTypeLabels),
    );
  }, [data.sources, sourceFallback, tShared]);

  const dummy = React.useMemo(
    () =>
      buildProductionSeries(
        sourceLabels.length ? sourceLabels : [t('communityGrid')],
        timeframe,
      ),
    [sourceLabels, timeframe, t],
  );

  const useLiveTelemetry = Boolean(
    telemetry?.enabled &&
      telemetry.configured &&
      !telemetryError &&
      telemetry.dataFrom,
  );

  const labels = useLiveTelemetry
    ? telemetry!.labels
    : timeframeLabels(timeframe, locale);
  const perSource = useLiveTelemetry
    ? telemetry!.productionBySource.map((s) => ({
        label: s.label,
        values: s.valuesKwh,
      }))
    : dummy.perSource;
  const consumption = useLiveTelemetry
    ? telemetry!.consumptionKwh
    : dummy.consumption;

  const dummyGrid = React.useMemo(
    () => buildGridFlowSeries(dummy.perSource, dummy.consumption),
    [dummy.consumption, dummy.perSource],
  );

  const gridImport = useLiveTelemetry
    ? telemetry!.gridImportKwh
    : dummyGrid.gridImport;
  const gridExport = useLiveTelemetry
    ? telemetry!.gridExportKwh
    : dummyGrid.gridExport;

  const totalProduced = useLiveTelemetry
    ? telemetry!.totals.producedKwh
    : perSource.reduce((acc, s) => acc + sum(s.values), 0);
  const totalConsumed = useLiveTelemetry
    ? telemetry!.totals.consumedKwh
    : sum(consumption);
  const net = totalProduced - totalConsumed;
  const totalGridImport = useLiveTelemetry
    ? telemetry!.totals.gridImportedKwh
    : sum(gridImport);
  const totalGridExport = useLiveTelemetry
    ? telemetry!.totals.gridExportedKwh
    : sum(gridExport);

  const productionVsConsumption: ChartSeries[] = [
    {
      key: 'produced',
      label: t('produced'),
      color: ENERGY_PALETTE[0]!,
      values: labels.map((_, i) =>
        perSource.reduce((acc, s) => acc + (s.values[i] ?? 0), 0),
      ),
    },
    {
      key: 'consumed',
      label: t('consumed'),
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

  const gridImportExport: ChartSeries[] = [
    {
      key: 'grid-import',
      label: t('gridImport'),
      color: ENERGY_PALETTE[4]!,
      values: gridImport,
    },
    {
      key: 'grid-export',
      label: t('gridExport'),
      color: ENERGY_PALETTE[1]!,
      values: gridExport,
    },
  ];

  const kwhSuffix = t('kwhSuffix');

  const statusMessage = React.useMemo(() => {
    if (telemetryLoading) return t('loadingTelemetry');
    if (telemetryError) return t('telemetryError');
    if (!telemetry?.configured) return t('dbNotConfigured');
    if (useLiveTelemetry && telemetry?.dataFrom && telemetry?.dataTo) {
      const from = new Date(telemetry.dataFrom).toLocaleDateString(locale);
      const to = new Date(telemetry.dataTo).toLocaleDateString(locale);
      return t('liveDataRange', { from, to });
    }
    if (telemetry?.enabled && !telemetry?.dataFrom) return t('noReadings');
    return t('placeholderTelemetry');
  }, [
    locale,
    t,
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
            label={t('totalProduced')}
            value={t('kwhValue', {
              value: totalProduced.toLocaleString(locale),
            })}
            accent={ENERGY_PALETTE[0]}
          />
          <StatCard
            label={t('totalConsumed')}
            value={t('kwhValue', {
              value: totalConsumed.toLocaleString(locale),
            })}
            accent={ENERGY_PALETTE[2]}
          />
          <StatCard
            label={t('netSurplus')}
            value={t('netKwhValue', {
              sign: net >= 0 ? '+' : '−',
              value: Math.abs(net).toLocaleString(locale),
            })}
            accent={net >= 0 ? ENERGY_PALETTE[1] : ENERGY_PALETTE[4]}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('productionVsConsumption')}</CardTitle>
        </CardHeader>
        <CardContent>
          {telemetryLoading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <BarChart
              series={productionVsConsumption}
              labels={labels}
              mode="grouped"
              valueSuffix={kwhSuffix}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('energyBySource')}</CardTitle>
        </CardHeader>
        <CardContent>
          {telemetryLoading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <BarChart
              series={bySource}
              labels={labels}
              mode="stacked"
              valueSuffix={kwhSuffix}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('gridImportVsExport')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {telemetryLoading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StatCard
                  label={t('totalGridImport')}
                  value={t('kwhValue', {
                    value: totalGridImport.toLocaleString(locale),
                  })}
                  accent={ENERGY_PALETTE[4]}
                />
                <StatCard
                  label={t('totalGridExport')}
                  value={t('kwhValue', {
                    value: totalGridExport.toLocaleString(locale),
                  })}
                  accent={ENERGY_PALETTE[1]}
                />
              </div>
              <BarChart
                series={gridImportExport}
                labels={labels}
                mode="grouped"
                valueSuffix={kwhSuffix}
              />
              <p className="text-1 text-neutral-11">{t('gridFlowsHint')}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
