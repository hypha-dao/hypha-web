import {
  ENERGY_TELEMETRY_PERIOD_CONFIG,
  type EnergyTelemetryAggregateRow,
} from './telemetry-assemble';
import type { EnergyTelemetryPeriod } from './telemetry-types';

export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Half-open UTC day keys in `[from, to)`. */
export function utcDayKeysInRange(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const end = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()),
  );
  while (cursor < end) {
    keys.push(utcDayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

export function utcDayStart(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00.000Z`);
}

export function nextUtcDayKey(dayKey: string): string {
  const next = utcDayStart(dayKey);
  next.setUTCDate(next.getUTCDate() + 1);
  return utcDayKey(next);
}

/** Inclusive UTC calendar days covering a rolling telemetry period. */
export function telemetryPeriodDayKeys(
  period: EnergyTelemetryPeriod,
  now = new Date(),
): string[] {
  const cfg = ENERGY_TELEMETRY_PERIOD_CONFIG[period];
  const from = new Date(now.getTime());
  if (cfg.unit === 'month') {
    from.setUTCMonth(from.getUTCMonth() - cfg.points);
  } else if (cfg.unit === 'week') {
    from.setUTCDate(from.getUTCDate() - cfg.points * 7);
  } else {
    from.setUTCDate(from.getUTCDate() - cfg.points);
  }

  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  end.setUTCDate(end.getUTCDate() + 1);
  return utcDayKeysInRange(from, end);
}

/**
 * One Azure range that covers every missing day. Days already cached in
 * the middle are refreshed in the same scan rather than issuing gaps.
 */
export function missingTelemetryRange(
  neededDayKeys: string[],
  cachedDayKeys: Iterable<string>,
): { from: Date; to: Date } | null {
  const cached =
    cachedDayKeys instanceof Set ? cachedDayKeys : new Set(cachedDayKeys);
  const missing = neededDayKeys.filter((day) => !cached.has(day));
  if (missing.length === 0) return null;
  const first = missing[0]!;
  const last = missing[missing.length - 1]!;
  return {
    from: utcDayStart(first),
    to: utcDayStart(nextUtcDayKey(last)),
  };
}

export function dayKeyFromTelemetryBucket(bucket: string): string {
  return bucket.slice(0, 10);
}

export function storeTelemetryRowsByDay(
  rows: EnergyTelemetryAggregateRow[],
  store: (dayKey: string, dayRows: EnergyTelemetryAggregateRow[]) => void,
  emptyDays: string[] = [],
) {
  const byDay = new Map<string, EnergyTelemetryAggregateRow[]>();
  for (const day of emptyDays) {
    byDay.set(day, []);
  }
  for (const row of rows) {
    const day = dayKeyFromTelemetryBucket(row.bucket);
    const list = byDay.get(day);
    if (list) list.push(row);
    else byDay.set(day, [row]);
  }
  for (const [day, dayRows] of byDay) {
    store(day, dayRows);
  }
}
