import 'server-only';

import { Pool } from 'pg';

import { getEnergyDbConfigFromEnv } from './azure-db-config';
import {
  assembleEnergyTelemetry,
  emptyEnergyTelemetryResponse,
  ENERGY_TELEMETRY_PERIOD_CONFIG,
  parseEnergyTelemetryPeriod,
  type EnergyTelemetryAggregateRow,
} from './telemetry-assemble';
import type { EnergyTelemetryResponse } from './telemetry-types';
import { createTtlCache } from './ttl-cache';

/** Charts poll every 60s; cache just under that so the first paint is reused. */
export const ENERGY_TELEMETRY_CACHE_TTL_MS = 45_000;

const telemetryCache = createTtlCache<EnergyTelemetryResponse>(
  ENERGY_TELEMETRY_CACHE_TTL_MS,
);

let energyDbPool: Pool | undefined;

function getEnergyDbPool(): Pool | null {
  const dbConfig = getEnergyDbConfigFromEnv();
  if (!dbConfig) return null;
  if (!energyDbPool) {
    energyDbPool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      password: dbConfig.password,
      ssl: dbConfig.ssl ? { rejectUnauthorized: false } : undefined,
      max: 4,
      idleTimeoutMillis: 15_000,
      // Cold Azure connects can take 8–15s; keep the rest of the 60s
      // route budget for the windowed aggregate (25s timed out on 30d).
      connectionTimeoutMillis: 15_000,
      query_timeout: 45_000,
    });
    energyDbPool.on('error', (error) => {
      console.warn('[energy/telemetry] pool error', error);
    });
  }
  return energyDbPool;
}

async function queryEnergyTelemetryUncached(input: {
  communityId: number;
  period: ReturnType<typeof parseEnergyTelemetryPeriod>;
  sourceLabels?: Record<number, string>;
}): Promise<EnergyTelemetryResponse> {
  const cfg = ENERGY_TELEMETRY_PERIOD_CONFIG[input.period];
  const pool = getEnergyDbPool();
  if (!pool) {
    return emptyEnergyTelemetryResponse(input.period, input.communityId, false);
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
          else 'export'
        end as kind,
        meter_id,
        sum(energy_wh)::bigint as total_wh,
        to_char(
          min(interval_start) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as first_reading,
        to_char(
          max(interval_start) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as last_reading
      from accounting.interval_readings
      where community_id = $1
        and interval_start >= now() - ${cfg.intervalSql}
        and (
          direction in ('consumption', 'production', 'import', 'export')
          or (
            direction is null
            and (
              meter_id between 1 and 5
              or meter_id in (9001, 9002, 9003)
            )
          )
        )
      group by 1, 2, 3
      order by 1 asc
    `;

  const started = Date.now();
  const result = await pool.query<EnergyTelemetryAggregateRow>(aggregateSql, [
    input.communityId,
  ]);
  console.info(
    `[energy/telemetry] community ${input.communityId} ${input.period} ${
      result.rowCount
    } rows in ${Date.now() - started}ms`,
  );

  return assembleEnergyTelemetry({
    period: input.period,
    communityId: input.communityId,
    configured: true,
    rows: result.rows,
    sourceLabels: input.sourceLabels,
  });
}

export async function fetchEnergyTelemetry(input: {
  communityId: number;
  period?: string | null;
  sourceLabels?: Record<number, string>;
}): Promise<EnergyTelemetryResponse> {
  const period = parseEnergyTelemetryPeriod(input.period);
  if (!getEnergyDbConfigFromEnv()) {
    return emptyEnergyTelemetryResponse(period, input.communityId, false);
  }

  const cacheKey = `${input.communityId}:${period}`;
  const telemetry = await telemetryCache.getOrLoad(cacheKey, () =>
    queryEnergyTelemetryUncached({
      communityId: input.communityId,
      period,
      sourceLabels: input.sourceLabels,
    }),
  );
  return structuredClone(telemetry);
}

/** Test helper. */
export function clearEnergyTelemetryCache() {
  telemetryCache.clear();
}
