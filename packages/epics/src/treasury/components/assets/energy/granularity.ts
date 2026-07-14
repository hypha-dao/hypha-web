/**
 * Daily / weekly / monthly buckets for the per-user drill-down charts
 * (consumer consumption on Overview, owner earnings on Ownership).
 *
 * Each granularity maps onto a server telemetry period so the same
 * live-or-placeholder pattern used by the Production & consumption tab
 * applies here too.
 */

import type { TelemetryPeriod } from '../../../hooks/use-space-energy-telemetry';
import { hashString, seeded } from './dummy-data';

export type Granularity = 'daily' | 'weekly' | 'monthly';

export const GRANULARITIES: {
  id: Granularity;
  period: TelemetryPeriod;
  points: number;
  /** Multiplier vs a single day, used to scale placeholder series. */
  dayScale: number;
}[] = [
  { id: 'daily', period: '30d', points: 30, dayScale: 1 },
  { id: 'weekly', period: '12w', points: 12, dayScale: 7 },
  { id: 'monthly', period: '12m', points: 12, dayScale: 30 },
];

export const granularityConfig = (granularity: Granularity) =>
  GRANULARITIES.find((g) => g.id === granularity) ?? GRANULARITIES[0]!;

/** X-axis labels for placeholder series (live telemetry ships its own). */
export const granularityLabels = (
  granularity: Granularity,
  locale = 'en',
): string[] => {
  const cfg = granularityConfig(granularity);
  const now = new Date();

  if (granularity === 'monthly') {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'short' });
    return Array.from({ length: cfg.points }, (_, i) => {
      const d = new Date(
        now.getFullYear(),
        now.getMonth() - (cfg.points - 1 - i),
        1,
      );
      return fmt.format(d);
    });
  }

  const fmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'numeric',
  });

  if (granularity === 'weekly') {
    const monday = new Date(now);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return Array.from({ length: cfg.points }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() - (cfg.points - 1 - i) * 7);
      return fmt.format(d);
    });
  }

  return Array.from({ length: cfg.points }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (cfg.points - 1 - i));
    return fmt.format(d);
  });
};

/**
 * Deterministic placeholder consumption for one member (kWh per bucket),
 * seeded off the wallet address so it is stable across renders.
 */
export const buildMemberConsumptionSeries = (
  address: string,
  granularity: Granularity,
): number[] => {
  const cfg = granularityConfig(granularity);
  const rand = seeded(hashString(address.toLowerCase()));
  const base = 6 + rand() * 14; // household baseline kWh / day
  return Array.from({ length: cfg.points }, (_, i) => {
    const wave =
      Math.sin((i / cfg.points) * Math.PI * 2 + rand() * 6) * 0.3 + 1;
    const noise = 0.75 + rand() * 0.5;
    return Math.round(base * wave * noise * cfg.dayScale);
  });
};

/**
 * Deterministic placeholder production for one source (kWh per bucket).
 * Mirrors `buildProductionSeries` in dummy-data.ts but bucketed by
 * granularity instead of the 7D/30D/90D/12M chart timeframes.
 */
export const buildSourceProductionSeries = (
  sourceLabel: string,
  granularity: Granularity,
): number[] => {
  const cfg = granularityConfig(granularity);
  const rand = seeded(hashString(sourceLabel));
  const base = 18 + rand() * 26; // baseline kWh / day for this source
  return Array.from({ length: cfg.points }, (_, i) => {
    const wave =
      Math.sin((i / cfg.points) * Math.PI * 2 + rand() * 6) * 0.35 + 1;
    const noise = 0.8 + rand() * 0.5;
    return Math.round(base * wave * noise * cfg.dayScale);
  });
};
