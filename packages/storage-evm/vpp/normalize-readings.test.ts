import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  normalizeIntervalReadings,
  DEFAULT_HOUSEHOLD_METER_IDS,
  DEFAULT_PRODUCTION_METER_IDS,
} from './normalize-readings';
import type { IntervalReading } from './types';

describe('normalize-readings', () => {
  it('maps null direction on household meters to consumption', () => {
    const rows: IntervalReading[] = [
      {
        interval_start: '2026-06-23T11:30:00.000Z',
        meter_id: 4,
        community_id: 0,
        energy_wh: 179,
        direction: null,
      },
    ];

    const { readings, stats } = normalizeIntervalReadings(rows);
    assert.equal(readings.length, 1);
    assert.equal(readings[0]?.direction, 'consumption');
    assert.equal(stats.normalizedNullDirection, 1);
  });

  it('maps null direction on production meters to production', () => {
    const rows: IntervalReading[] = [
      {
        interval_start: '2026-06-23T11:30:00.000Z',
        meter_id: 9001,
        community_id: 0,
        energy_wh: 90,
        direction: null,
      },
    ];

    const { readings } = normalizeIntervalReadings(rows);
    assert.equal(readings[0]?.direction, 'production');
  });

  it('drops unmapped meters when allowedMeterIds is set', () => {
    const rows: IntervalReading[] = [
      {
        interval_start: '2026-06-23T11:30:00.000Z',
        meter_id: 99,
        community_id: 0,
        energy_wh: 100,
        direction: 'consumption',
      },
    ];

    const allowed = new Set([
      ...DEFAULT_HOUSEHOLD_METER_IDS,
      ...DEFAULT_PRODUCTION_METER_IDS,
    ]);
    const { readings, stats } = normalizeIntervalReadings(rows, {
      allowedMeterIds: allowed,
    });
    assert.equal(readings.length, 0);
    assert.equal(stats.skippedUnmappedMeter, 1);
  });
});
