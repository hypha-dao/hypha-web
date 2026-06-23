import type { IntervalReading } from './types';

export const DEFAULT_HOUSEHOLD_METER_IDS = new Set([1, 2, 3, 4, 5]);
export const DEFAULT_PRODUCTION_METER_IDS = new Set([9001, 9002, 9003]);

export type NormalizeReadingsStats = {
  inputRows: number;
  outputRows: number;
  normalizedNullDirection: number;
  skippedUnknownDirection: number;
  skippedUnmappedMeter: number;
};

export type NormalizeReadingsOptions = {
  householdMeterIds?: Set<number>;
  productionMeterIds?: Set<number>;
  /** Allowed meter IDs (household deviceToMember + production meters). Rows outside are dropped. */
  allowedMeterIds?: Set<number>;
};

/**
 * Normalize Azure interval rows for the VPP parser:
 * - null direction on household meters → consumption
 * - null direction on production meters → production
 * - drop rows with unknown direction or unmapped meters
 */
export function normalizeIntervalReadings(
  rows: IntervalReading[],
  options: NormalizeReadingsOptions = {},
): { readings: IntervalReading[]; stats: NormalizeReadingsStats } {
  const householdMeterIds =
    options.householdMeterIds ?? DEFAULT_HOUSEHOLD_METER_IDS;
  const productionMeterIds =
    options.productionMeterIds ?? DEFAULT_PRODUCTION_METER_IDS;
  const allowedMeterIds = options.allowedMeterIds;

  const stats: NormalizeReadingsStats = {
    inputRows: rows.length,
    outputRows: 0,
    normalizedNullDirection: 0,
    skippedUnknownDirection: 0,
    skippedUnmappedMeter: 0,
  };

  const readings: IntervalReading[] = [];

  for (const row of rows) {
    if (allowedMeterIds && !allowedMeterIds.has(row.meter_id)) {
      stats.skippedUnmappedMeter++;
      continue;
    }

    let direction = row.direction;

    if (
      direction == null ||
      direction === ('' as IntervalReading['direction'])
    ) {
      if (householdMeterIds.has(row.meter_id)) {
        direction = 'consumption';
        stats.normalizedNullDirection++;
      } else if (productionMeterIds.has(row.meter_id)) {
        direction = 'production';
        stats.normalizedNullDirection++;
      } else {
        stats.skippedUnknownDirection++;
        continue;
      }
    }

    if (
      direction !== 'consumption' &&
      direction !== 'production' &&
      direction !== 'import'
    ) {
      stats.skippedUnknownDirection++;
      continue;
    }

    readings.push({ ...row, direction });
  }

  stats.outputRows = readings.length;
  return { readings, stats };
}

export function logNormalizeStats(
  intervalStart: string,
  stats: NormalizeReadingsStats,
): void {
  console.log(
    `  ${intervalStart} normalize: in=${stats.inputRows} out=${stats.outputRows} null→typed=${stats.normalizedNullDirection} skipped_dir=${stats.skippedUnknownDirection} skipped_meter=${stats.skippedUnmappedMeter}`,
  );
}
