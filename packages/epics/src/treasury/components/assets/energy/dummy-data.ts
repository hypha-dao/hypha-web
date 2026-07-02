/**
 * Deterministic placeholder energy telemetry.
 *
 * Production & consumption readings will come from a backend/indexer API later;
 * until then these helpers synthesize stable, realistic-looking series so the
 * charts can be designed and reviewed. Everything is seeded off the source
 * label + day index, so the same inputs always render the same curves (no
 * flicker between renders / refresh).
 */

export type Timeframe = '7d' | '30d' | '90d' | '12m';

export const TIMEFRAMES: {
  id: Timeframe;
  label: string;
  points: number;
  unit: 'day' | 'month';
}[] = [
  { id: '7d', label: '7D', points: 7, unit: 'day' },
  { id: '30d', label: '30D', points: 30, unit: 'day' },
  { id: '90d', label: '90D', points: 90, unit: 'day' },
  { id: '12m', label: '12M', points: 12, unit: 'month' },
];

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

// Mulberry32 — tiny deterministic PRNG.
export const seeded = (seed: number) => {
  let t = seed + 0x6d2b79f5;
  return () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

export const hashString = (value: string) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const timeframeLabels = (timeframe: Timeframe): string[] => {
  const tf = TIMEFRAMES.find((t) => t.id === timeframe) ?? TIMEFRAMES[1]!;
  const now = new Date();
  if (tf.unit === 'month') {
    return Array.from({ length: tf.points }, (_, i) => {
      const d = new Date(
        now.getFullYear(),
        now.getMonth() - (tf.points - 1 - i),
        1,
      );
      return MONTHS[d.getMonth()]!;
    });
  }
  return Array.from({ length: tf.points }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (tf.points - 1 - i));
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });
};

/** kWh produced per source over the timeframe, plus the community consumption line. */
export const buildProductionSeries = (
  sourceLabels: string[],
  timeframe: Timeframe,
) => {
  const tf = TIMEFRAMES.find((t) => t.id === timeframe) ?? TIMEFRAMES[1]!;
  const scale = tf.unit === 'month' ? 30 : 1;

  const perSource = sourceLabels.map((label) => {
    const rand = seeded(hashString(label));
    const base = 18 + rand() * 26; // baseline kWh / day for this source
    const values = Array.from({ length: tf.points }, (_, i) => {
      // gentle weekly/seasonal wave + per-point noise
      const wave =
        Math.sin((i / tf.points) * Math.PI * 2 + rand() * 6) * 0.35 + 1;
      const noise = 0.8 + rand() * 0.5;
      return Math.round(base * wave * noise * scale);
    });
    return { label, values };
  });

  const consumption = Array.from({ length: tf.points }, (_, i) => {
    const total = perSource.reduce((sum, s) => sum + (s.values[i] ?? 0), 0);
    const rand = seeded(hashString(`consumption-${i}`));
    // community consumes 70-105% of what it produces
    return Math.round(total * (0.7 + rand() * 0.35));
  });

  return { perSource, consumption };
};

/** Community grid import/export derived from production vs consumption per bucket. */
export const buildGridFlowSeries = (
  perSource: { values: number[] }[],
  consumption: number[],
) => {
  const len = consumption.length;
  const gridImport: number[] = [];
  const gridExport: number[] = [];

  for (let i = 0; i < len; i++) {
    const produced = perSource.reduce((acc, s) => acc + (s.values[i] ?? 0), 0);
    const consumed = consumption[i] ?? 0;
    const deficit = consumed - produced;
    gridImport.push(Math.max(0, deficit));
    gridExport.push(Math.max(0, -deficit));
  }

  return { gridImport, gridExport };
};

/** Settled energy (kWh equivalent reconciled) per period. */
export const buildSettlementSeries = (timeframe: Timeframe) => {
  const tf = TIMEFRAMES.find((t) => t.id === timeframe) ?? TIMEFRAMES[1]!;
  const scale = tf.unit === 'month' ? 28 : 1;
  return timeframeLabels(timeframe).map((label, i) => {
    const rand = seeded(hashString(`settle-${timeframe}-${i}`));
    return { label, value: Math.round((10 + rand() * 22) * scale) };
  });
};
