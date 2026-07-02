import 'server-only';

import { Client } from 'pg';

import { getEnergyDbConfigFromEnv } from './azure-db-config';
import {
  ENERGY_TELEMETRY_PERIODS,
  PRODUCTION_METER_LABELS,
  type EnergyTelemetryMeterSeries,
  type EnergyTelemetryPeriod,
  type EnergyTelemetryResponse,
  type EnergyTelemetrySourceSeries,
} from './telemetry-types';

type AggregateRow = {
  bucket: string;
  kind: 'consumption' | 'production' | 'import' | 'export';
  meter_id: number;
  total_wh: string;
};

const PERIOD_CONFIG: Record<
  EnergyTelemetryPeriod,
  { points: number; unit: 'day' | 'week' | 'month'; intervalSql: string }
> = {
  '7d': { points: 7, unit: 'day', intervalSql: "interval '7 days'" },
  '30d': { points: 30, unit: 'day', intervalSql: "interval '30 days'" },
  '90d': { points: 90, unit: 'day', intervalSql: "interval '90 days'" },
  '12w': { points: 12, unit: 'week', intervalSql: "interval '12 weeks'" },
  '12m': { points: 12, unit: 'month', intervalSql: "interval '12 months'" },
};

function parsePeriod(raw: string | null | undefined): EnergyTelemetryPeriod {
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

function buildBucketKeys(
  period: EnergyTelemetryPeriod,
  dataFrom: Date | null,
  dataTo: Date | null,
): { keys: string[]; labels: string[] } {
  const cfg = PERIOD_CONFIG[period];
  const end = dataTo ?? new Date();
  const keys: string[] = [];
  const labels: string[] = [];

  if (cfg.unit === 'month') {
    for (let i = cfg.points - 1; i >= 0; i--) {
      const d = new Date(
        Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1),
      );
      const key = d.toISOString().slice(0, 7);
      keys.push(key);
      labels.push(formatMonthLabel(d.toISOString()));
    }
    return { keys, labels };
  }

  if (cfg.unit === 'week') {
    // Postgres date_trunc('week', …) buckets start on Monday (ISO weeks).
    const monday = new Date(end);
    monday.setUTCHours(0, 0, 0, 0);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    for (let i = cfg.points - 1; i >= 0; i--) {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() - i * 7);
      const key = d.toISOString().slice(0, 10);
      keys.push(key);
      labels.push(formatDayLabel(d.toISOString()));
    }
    return { keys, labels };
  }

  for (let i = cfg.points - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);
    d.setUTCHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    keys.push(key);
    labels.push(formatDayLabel(d.toISOString()));
  }

  if (dataFrom) {
    // keys already span ending at dataTo; sparse early buckets stay zero
  }

  return { keys, labels };
}

function bucketKeyFromRow(
  bucketIso: string,
  unit: 'day' | 'week' | 'month',
): string {
  return unit === 'month' ? bucketIso.slice(0, 7) : bucketIso.slice(0, 10);
}

function emptyResponse(
  period: EnergyTelemetryPeriod,
  communityId: number | null,
  configured: boolean,
): EnergyTelemetryResponse {
  const { keys, labels } = buildBucketKeys(period, null, null);
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

export async function fetchEnergyTelemetry(input: {
  communityId: number;
  period?: string | null;
  sourceLabels?: Record<number, string>;
}): Promise<EnergyTelemetryResponse> {
  const period = parsePeriod(input.period);
  const cfg = PERIOD_CONFIG[period];
  const dbConfig = getEnergyDbConfigFromEnv();

  if (!dbConfig) {
    return emptyResponse(period, input.communityId, false);
  }

  const client = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    ssl: dbConfig.ssl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15_000,
    query_timeout: 20_000,
  });

  await client.connect();

  try {
    const rangeSql = `
      select min(interval_start) as min_t, max(interval_start) as max_t
      from accounting.interval_readings
      where community_id = $1
    `;
    const rangeResult = await client.query<{
      min_t: Date | null;
      max_t: Date | null;
    }>(rangeSql, [input.communityId]);
    const minT = rangeResult.rows[0]?.min_t ?? null;
    const maxT = rangeResult.rows[0]?.max_t ?? null;

    if (!minT || !maxT) {
      return {
        ...emptyResponse(period, input.communityId, true),
        enabled: true,
      };
    }

    const truncateUnit =
      cfg.unit === 'month' ? 'month' : cfg.unit === 'week' ? 'week' : 'day';
    const aggregateSql = `
      select
        date_trunc('${truncateUnit}', interval_start at time zone 'UTC')::text as bucket,
        case
          when direction = 'production'
            or (direction is null and meter_id in (9001, 9002, 9003))
            then 'production'
          when direction = 'consumption'
            or (direction is null and meter_id between 1 and 5)
            then 'consumption'
          when direction = 'import' then 'import'
          when direction = 'export' then 'export'
          else null
        end as kind,
        meter_id,
        sum(energy_wh)::bigint as total_wh
      from accounting.interval_readings
      where community_id = $1
        and interval_start >= (now() at time zone 'utc') - ${cfg.intervalSql}
        and (
          direction in ('consumption', 'production', 'import', 'export')
          or direction is null
        )
      group by 1, 2, 3
      having case
          when direction = 'production'
            or (direction is null and meter_id in (9001, 9002, 9003))
            then 'production'
          when direction = 'consumption'
            or (direction is null and meter_id between 1 and 5)
            then 'consumption'
          when direction = 'import' then 'import'
          when direction = 'export' then 'export'
          else null
        end is not null
      order by 1 asc
    `;

    const aggResult = await client.query<AggregateRow>(aggregateSql, [
      input.communityId,
    ]);

    const { keys, labels } = buildBucketKeys(period, minT, maxT);
    const keyIndex = new Map(keys.map((k, i) => [k, i]));
    const consumptionWh = keys.map(() => 0);
    const gridImportWh = keys.map(() => 0);
    const gridExportWh = keys.map(() => 0);
    const productionByMeter = new Map<number, number[]>();
    const consumptionByMeterWh = new Map<number, number[]>();

    for (const row of aggResult.rows) {
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
      (acc, s) => acc + s.valuesKwh.reduce((a, b) => a + b, 0),
      0,
    );
    const consumedKwh = consumptionKwh.reduce((a, b) => a + b, 0);
    const gridImportedKwh = gridImportKwh.reduce((a, b) => a + b, 0);
    const gridExportedKwh = gridExportKwh.reduce((a, b) => a + b, 0);

    return {
      enabled: true,
      configured: true,
      period,
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
      dataFrom: minT.toISOString(),
      dataTo: maxT.toISOString(),
      communityId: input.communityId,
    };
  } finally {
    await client.end();
  }
}

export { parsePeriod as parseEnergyTelemetryPeriod };
