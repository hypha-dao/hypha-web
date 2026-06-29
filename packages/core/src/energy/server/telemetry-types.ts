export type EnergyTelemetryPeriod = '7d' | '30d' | '90d' | '12m';

export type EnergyTelemetrySourceSeries = {
  meterId: number;
  label: string;
  valuesKwh: number[];
};

export type EnergyTelemetryResponse = {
  enabled: boolean;
  configured: boolean;
  period: EnergyTelemetryPeriod;
  labels: string[];
  consumptionKwh: number[];
  productionBySource: EnergyTelemetrySourceSeries[];
  /** Grid energy bought from the external grid per bucket (kWh). */
  gridImportKwh: number[];
  /** Surplus grid energy exported per bucket (kWh). */
  gridExportKwh: number[];
  totals: {
    producedKwh: number;
    consumedKwh: number;
    netKwh: number;
    gridImportedKwh: number;
    gridExportedKwh: number;
  };
  dataFrom: string | null;
  dataTo: string | null;
  communityId: number | null;
};

export const ENERGY_TELEMETRY_PERIODS: EnergyTelemetryPeriod[] = [
  '7d',
  '30d',
  '90d',
  '12m',
];

export const PRODUCTION_METER_LABELS: Record<number, string> = {
  9001: 'Solar park',
  9002: 'Battery 1',
  9003: 'Battery 2',
};
