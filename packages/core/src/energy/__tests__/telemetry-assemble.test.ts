import { describe, expect, it } from 'vitest';

import { assembleEnergyTelemetry } from '../server/telemetry-assemble';

describe('assembleEnergyTelemetry', () => {
  it('aggregates windowed rows without a full-table min/max scan', () => {
    const telemetry = assembleEnergyTelemetry({
      period: '7d',
      communityId: 2,
      configured: true,
      rows: [
        {
          bucket: '2026-10-28T00:00:00.000Z',
          kind: 'production',
          meter_id: 9001,
          total_wh: '2500',
        },
        {
          bucket: '2026-10-28T00:00:00.000Z',
          kind: 'consumption',
          meter_id: 7,
          total_wh: '1000',
        },
        {
          bucket: '2026-10-29T00:00:00.000Z',
          kind: 'consumption',
          meter_id: 8,
          total_wh: '4000',
        },
      ],
      sourceLabels: { 9001: 'Ponta school PV' },
    });

    expect(telemetry.enabled).toBe(true);
    expect(telemetry.communityId).toBe(2);
    expect(telemetry.productionBySource[0]).toMatchObject({
      meterId: 9001,
      label: 'Ponta school PV',
    });
    expect(telemetry.consumptionByMeter.map((row) => row.meterId)).toEqual([
      7, 8,
    ]);
    expect(telemetry.totals.producedKwh).toBe(2.5);
    expect(telemetry.totals.consumedKwh).toBe(5);
    expect(telemetry.dataFrom).toBe('2026-10-28T00:00:00.000Z');
    expect(telemetry.dataTo).toBe('2026-10-29T00:00:00.000Z');
  });

  it('returns an enabled empty series when the period has no rows', () => {
    const telemetry = assembleEnergyTelemetry({
      period: '30d',
      communityId: 2,
      configured: true,
      rows: [],
    });
    expect(telemetry.enabled).toBe(true);
    expect(telemetry.dataFrom).toBeNull();
    expect(telemetry.consumptionByMeter).toEqual([]);
  });
});
