import { describe, expect, it } from 'vitest';

import {
  missingTelemetryRange,
  storeTelemetryRowsByDay,
  telemetryPeriodDayKeys,
  utcDayKey,
  utcDayKeysInRange,
} from '../server/telemetry-window';

describe('telemetry window helpers', () => {
  it('lists inclusive UTC days for a 7d period', () => {
    const keys = telemetryPeriodDayKeys(
      '7d',
      new Date('2026-10-29T15:00:00.000Z'),
    );
    expect(keys[0]).toBe('2026-10-22');
    expect(keys.at(-1)).toBe('2026-10-29');
    expect(keys).toHaveLength(8);
  });

  it('plans one Azure range for the missing tail after a 7d fill', () => {
    const needed = telemetryPeriodDayKeys(
      '30d',
      new Date('2026-10-29T15:00:00.000Z'),
    );
    const cached = new Set(
      telemetryPeriodDayKeys('7d', new Date('2026-10-29T15:00:00.000Z')),
    );
    const missing = missingTelemetryRange(needed, cached);
    expect(missing).toEqual({
      from: new Date('2026-09-29T00:00:00.000Z'),
      to: new Date('2026-10-22T00:00:00.000Z'),
    });
  });

  it('returns null when every needed day is cached', () => {
    const days = ['2026-10-28', '2026-10-29'];
    expect(missingTelemetryRange(days, days)).toBeNull();
  });

  it('stores fetched rows by UTC day and fills empty days', () => {
    const stored = new Map<string, { bucket: string }[]>();
    storeTelemetryRowsByDay(
      [
        {
          bucket: '2026-10-28 00:00:00+00',
          kind: 'consumption',
          meter_id: 7,
          total_wh: '1000',
        },
      ],
      (day, rows) => stored.set(day, rows),
      utcDayKeysInRange(
        new Date('2026-10-28T00:00:00.000Z'),
        new Date('2026-10-30T00:00:00.000Z'),
      ),
    );

    expect([...stored.keys()]).toEqual(['2026-10-28', '2026-10-29']);
    expect(stored.get('2026-10-28')).toHaveLength(1);
    expect(stored.get('2026-10-29')).toEqual([]);
    expect(utcDayKey(new Date('2026-10-28T23:59:59.000Z'))).toBe('2026-10-28');
  });
});
