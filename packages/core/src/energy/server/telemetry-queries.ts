import 'server-only';

import { Pool } from 'pg';

import { getEnergyDbConfigFromEnv } from './azure-db-config';
import {
  assembleEnergyTelemetry,
  emptyEnergyTelemetryResponse,
  parseEnergyTelemetryPeriod,
  type EnergyTelemetryAggregateRow,
} from './telemetry-assemble';
import type { EnergyTelemetryResponse } from './telemetry-types';
import {
  missingTelemetryRange,
  storeTelemetryRowsByDay,
  telemetryPeriodDayKeys,
  utcDayKeysInRange,
} from './telemetry-window';
import { createTtlCache } from './ttl-cache';

/** Keep assembled period payloads for the same freshness window as the route. */
export const ENERGY_TELEMETRY_CACHE_TTL_MS = 5 * 60_000;
/** Daily buckets are reused across 7d/30d/12m on the same instance. */
const ENERGY_TELEMETRY_DAY_TTL_MS = 10 * 60_000;

const telemetryCache = createTtlCache<EnergyTelemetryResponse>(
  ENERGY_TELEMETRY_CACHE_TTL_MS,
);
const telemetryDayCache = createTtlCache<EnergyTelemetryAggregateRow[]>(
  ENERGY_TELEMETRY_DAY_TTL_MS,
);

const communityWindowLoads = new Map<number, Promise<void>>();

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
      max: 8,
      idleTimeoutMillis: 15_000,
      // Cold Azure connects can take 8–15s. Same-key loads coalesce in
      // the TTL cache, so pool slots are for distinct community:period
      // keys. 30d aggregates have reached ~43s; 15s connect + 70s query
      // fits the 90s route budget. `query_timeout` only stops waiting on our
      // side; `statement_timeout` makes Azure cancel the query too, so an
      // abandoned aggregate does not keep loading the database.
      connectionTimeoutMillis: 15_000,
      statement_timeout: 65_000,
      query_timeout: 70_000,
    });
    energyDbPool.on('error', (error) => {
      console.warn('[energy/telemetry] pool error', error);
    });
  }
  return energyDbPool;
}

const AGGREGATE_SQL = `
      select
        date_trunc('day', interval_start at time zone 'UTC')::text as bucket,
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
        and interval_start >= $2
        and interval_start < $3
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

function dayCacheKey(communityId: number, dayKey: string) {
  return `${communityId}:${dayKey}`;
}

function cachedDaysFor(communityId: number, dayKeys: string[]): Set<string> {
  const cached = new Set<string>();
  for (const day of dayKeys) {
    if (telemetryDayCache.get(dayCacheKey(communityId, day))) {
      cached.add(day);
    }
  }
  return cached;
}

async function queryTelemetryWindow(
  pool: Pool,
  communityId: number,
  from: Date,
  to: Date,
): Promise<EnergyTelemetryAggregateRow[]> {
  const started = Date.now();
  const result = await pool.query<EnergyTelemetryAggregateRow>(AGGREGATE_SQL, [
    communityId,
    from.toISOString(),
    to.toISOString(),
  ]);
  console.info(
    `[energy/telemetry] community ${communityId} ${from.toISOString()}–${to.toISOString()} ${
      result.rowCount
    } rows in ${Date.now() - started}ms`,
  );
  return result.rows;
}

async function fillMissingTelemetryDays(
  pool: Pool,
  communityId: number,
  dayKeys: string[],
): Promise<void> {
  const run = async () => {
    const missing = missingTelemetryRange(
      dayKeys,
      cachedDaysFor(communityId, dayKeys),
    );
    if (!missing) return;

    const rows = await queryTelemetryWindow(
      pool,
      communityId,
      missing.from,
      missing.to,
    );
    storeTelemetryRowsByDay(
      rows,
      (day, dayRows) => {
        telemetryDayCache.set(dayCacheKey(communityId, day), dayRows);
      },
      utcDayKeysInRange(missing.from, missing.to),
    );
  };

  const previous = communityWindowLoads.get(communityId);
  const chained = previous ? previous.then(run, run) : run();
  communityWindowLoads.set(communityId, chained);
  try {
    await chained;
  } finally {
    if (communityWindowLoads.get(communityId) === chained) {
      communityWindowLoads.delete(communityId);
    }
  }

  if (missingTelemetryRange(dayKeys, cachedDaysFor(communityId, dayKeys))) {
    await fillMissingTelemetryDays(pool, communityId, dayKeys);
  }
}

function rowsForDays(
  communityId: number,
  dayKeys: string[],
): EnergyTelemetryAggregateRow[] {
  const rows: EnergyTelemetryAggregateRow[] = [];
  for (const day of dayKeys) {
    const dayRows = telemetryDayCache.get(dayCacheKey(communityId, day));
    if (dayRows) rows.push(...dayRows);
  }
  return rows;
}

async function queryEnergyTelemetryUncached(input: {
  communityId: number;
  period: ReturnType<typeof parseEnergyTelemetryPeriod>;
  sourceLabels?: Record<number, string>;
}): Promise<EnergyTelemetryResponse> {
  const pool = getEnergyDbPool();
  if (!pool) {
    return emptyEnergyTelemetryResponse(input.period, input.communityId, false);
  }

  const dayKeys = telemetryPeriodDayKeys(input.period);
  await fillMissingTelemetryDays(pool, input.communityId, dayKeys);

  return assembleEnergyTelemetry({
    period: input.period,
    communityId: input.communityId,
    configured: true,
    rows: rowsForDays(input.communityId, dayKeys),
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
  telemetryDayCache.clear();
  communityWindowLoads.clear();
}
