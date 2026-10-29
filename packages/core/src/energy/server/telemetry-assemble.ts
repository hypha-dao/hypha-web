import {
  ENERGY_TELEMETRY_PERIODS,
  PRODUCTION_METER_LABELS,
  type EnergyTelemetryMeterSeries,
  type EnergyTelemetryPeriod,
  type EnergyTelemetryResponse,
  type EnergyTelemetrySourceSeries,
} from './telemetry-types';

export type EnergyTelemetryAggregateRow = {
  bucket: string;
  kind: 'consumption' | 'production' | 'import' | 'export';
  meter_id: number;
  total_wh: string;
};

export const ENERGY_TELEMETRY_PERIOD_CONFIG: Record<
  EnergyTelemetryPeriod,
  { points: number; unit: 'day' | 'week' | 'month'; intervalSql: string }
> = {
  '7d': { points: 7, unit: 'day', intervalSql: "interval '7 days'" },
  '30d': { points: 30, unit: 'day', intervalSql: "interval '30 days'" },
  '90d': { points: 90, unit: 'day', intervalSql: "interval '90 days'" },
  '12w': { points: 12, unit: 'week', intervalSql: "interval '12 weeks'" },
  '12m': { points: 12, unit: 'month', intervalSql: "interval '12 months'" },
};

export function parseEnergyTelemetryPeriod(
  raw: string | null | undefined,
): EnergyTelemetryPeriod {
  if (raw && ENERGY_TELEMETRY_PERIODS.includes(raw as EnergyTelemetryPeriod)) {
    return raw as EnergyTelemetryPeriod;
  }
  return '30d';
}

function whToKwh(wh: number): number {
  return Math.round((wh / 1000) * 100) / 100;
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatMonthLabel(iso: string): string {
  const d = new Date(iso);
  return MONTHS[d.getUTCMonth()] ?? iso;
}

export function buildEnergyTelemetryBucketKeys(
  period: EnergyTelemetryPeriod,
  dataTo: Date | null,
): { keys: string[]; labels: string[] } {
  const cfg = ENERGY_TELEMETRY_PERIOD_CONFIG[period];
  const end = dataTo ?? new Date();
  const keys: string[] = [];
  const labels: string[] = [];

  if (cfg.unit === 'month') {
    for (let i = cfg.points - 1; i >= 0; i--) {
      const d = new Date(
        Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1),
      );
      keys.push(d.toISOString().slice(0, 7));
      labels.push(formatMonthLabel(d.toISOString()));
    }
    return { keys, labels };
  }

  if (cfg.unit === 'week') {
    const monday = new Date(end);
    monday.setUTCHours(0, 0, 0, 0);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    for (let i = cfg.points - 1; i >= 0; i--) {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() - i * 7);
      keys.push(d.toISOString().slice(0, 10));
      labels.push(formatDayLabel(d.toISOString()));
    }
    return { keys, labels };
  }

  for (let i = cfg.points - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);
    d.setUTCHours(0, 0, 0, 0);
    keys.push(d.toISOString().slice(0, 10));
    labels.push(formatDayLabel(d.toISOString()));
  }
  return { keys, labels };
}

function bucketKeyFromRow(
  bucketIso: string,
  unit: 'day' | 'week' | 'month',
): string {
  return unit === 'month' ? bucketIso.slice(0, 7) : bucketIso.slice(0, 10);
}

export function emptyEnergyTelemetryResponse(
  period: EnergyTelemetryPeriod,
  communityId: number | null,
  configured: boolean,
): EnergyTelemetryResponse {
  const { keys, labels } = buildEnergyTelemetryBucketKeys(period, null);
  return {
    enabled: false,
    configured,
    period,
    labels,
    consumptionKwh: keys.map(() => 0),
    consumptionByMeter: [],
    productionBySource: [],
    gridImportKwh: keys.map(() => 0),
    gridExportKwh: keys.map(() => 0),
    totals: {
      producedKwh: 0,
      consumedKwh: 0,
      netKwh: 0,
      gridImportedKwh: 0,
      gridExportedKwh: 0,
    },
    dataFrom: null,
    dataTo: null,
    communityId,
  };
}

export function assembleEnergyTelemetry(input: {
  period: EnergyTelemetryPeriod;
  communityId: number;
  configured: boolean;
  rows: EnergyTelemetryAggregateRow[];
  sourceLabels?: Record<number, string>;
}): EnergyTelemetryResponse {
  const cfg = ENERGY_TELEMETRY_PERIOD_CONFIG[input.period];
  if (input.rows.length === 0) {
    return {
      ...emptyEnergyTelemetryResponse(
        input.period,
        input.communityId,
        input.configured,
      ),
      enabled: input.configured,
    };
  }

  let minT: Date | null = null;
  let maxT: Date | null = null;
  for (const row of input.rows) {
    const parsed = new Date(row.bucket);
    if (Number.isNaN(parsed.getTime())) continue;
    if (!minT || parsed < minT) minT = parsed;
    if (!maxT || parsed > maxT) maxT = parsed;
  }

  const { keys, labels } = buildEnergyTelemetryBucketKeys(input.period, maxT);
  const keyIndex = new Map(keys.map((key, index) => [key, index]));
  const consumptionWh = keys.map(() => 0);
  const gridImportWh = keys.map(() => 0);
  const gridExportWh = keys.map(() => 0);
  const productionByMeter = new Map<number, number[]>();
  const consumptionByMeterWh = new Map<number, number[]>();

  for (const row of input.rows) {
    const key = bucketKeyFromRow(row.bucket, cfg.unit);
    const idx = keyIndex.get(key);
    if (idx === undefined) continue;

    const wh = Number(row.total_wh);
    if (row.kind === 'consumption') {
      consumptionWh[idx] = (consumptionWh[idx] ?? 0) + wh;
      const series =
        consumptionByMeterWh.get(row.meter_id) ?? keys.map(() => 0);
      series[idx] = (series[idx] ?? 0) + wh;
      consumptionByMeterWh.set(row.meter_id, series);
    } else if (row.kind === 'production') {
      const series = productionByMeter.get(row.meter_id) ?? keys.map(() => 0);
      series[idx] = (series[idx] ?? 0) + wh;
      productionByMeter.set(row.meter_id, series);
    } else if (row.kind === 'import') {
      gridImportWh[idx] = (gridImportWh[idx] ?? 0) + wh;
    } else if (row.kind === 'export') {
      gridExportWh[idx] = (gridExportWh[idx] ?? 0) + wh;
    }
  }

  for (let i = 0; i < keys.length; i++) {
    if (gridImportWh[i]! > 0 || gridExportWh[i]! > 0) continue;

    let producedWh = 0;
    for (const values of productionByMeter.values()) {
      producedWh += values[i] ?? 0;
    }
    const consumedWh = consumptionWh[i] ?? 0;
    if (consumedWh === 0 && producedWh === 0) continue;

    if (consumedWh > producedWh) {
      gridImportWh[i] = consumedWh - producedWh;
    } else if (producedWh > consumedWh) {
      gridExportWh[i] = producedWh - consumedWh;
    }
  }

  const productionBySource: EnergyTelemetrySourceSeries[] = [
    ...productionByMeter.entries(),
  ]
    .sort(([a], [b]) => a - b)
    .map(([meterId, valuesWh]) => ({
      meterId,
      label:
        input.sourceLabels?.[meterId] ??
        PRODUCTION_METER_LABELS[meterId] ??
        `Source ${meterId}`,
      valuesKwh: valuesWh.map((wh) => whToKwh(wh)),
    }));

  const consumptionByMeter: EnergyTelemetryMeterSeries[] = [
    ...consumptionByMeterWh.entries(),
  ]
    .sort(([a], [b]) => a - b)
    .map(([meterId, valuesWh]) => ({
      meterId,
      valuesKwh: valuesWh.map((wh) => whToKwh(wh)),
    }));

  const consumptionKwh = consumptionWh.map((wh) => whToKwh(wh));
  const gridImportKwh = gridImportWh.map((wh) => whToKwh(wh));
  const gridExportKwh = gridExportWh.map((wh) => whToKwh(wh));
  const producedKwh = productionBySource.reduce(
    (acc, series) => acc + series.valuesKwh.reduce((a, b) => a + b, 0),
    0,
  );
  const consumedKwh = consumptionKwh.reduce((a, b) => a + b, 0);
  const gridImportedKwh = gridImportKwh.reduce((a, b) => a + b, 0);
  const gridExportedKwh = gridExportKwh.reduce((a, b) => a + b, 0);

  return {
    enabled: true,
    configured: input.configured,
    period: input.period,
    labels,
    consumptionKwh,
    consumptionByMeter,
    productionBySource,
    gridImportKwh,
    gridExportKwh,
    totals: {
      producedKwh: Math.round(producedKwh * 100) / 100,
      consumedKwh: Math.round(consumedKwh * 100) / 100,
      netKwh: Math.round((producedKwh - consumedKwh) * 100) / 100,
      gridImportedKwh: Math.round(gridImportedKwh * 100) / 100,
      gridExportedKwh: Math.round(gridExportedKwh * 100) / 100,
    },
    dataFrom: minT?.toISOString() ?? null,
    dataTo: maxT?.toISOString() ?? null,
    communityId: input.communityId,
  };
}
