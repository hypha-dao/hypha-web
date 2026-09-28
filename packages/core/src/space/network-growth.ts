/** Months shown on the network growth charts. */
export const NETWORK_GROWTH_MONTHS = 12;

export type MonthlyCount = {
  month: string;
  count: number;
};

export type CumulativePoint = {
  month: string;
  cumulative: number;
};

/**
 * Network census that the database can answer.
 *
 * Spaces, members, and agreements on the page still use the loaded directory
 * (public plus private). These figures are the dated additions and the two
 * cumulative series, plus the token total.
 */
export type NetworkGrowth = {
  tokens: { total: number; thisMonth: number };
  membersThisMonth: number;
  agreementsThisMonth: number;
  members: CumulativePoint[];
  agreements: CumulativePoint[];
};

export function toMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function recentMonthKeys(
  now: Date,
  size = NETWORK_GROWTH_MONTHS,
): string[] {
  const keys: string[] = [];
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth();
  for (let offset = size - 1; offset >= 0; offset -= 1) {
    keys.push(toMonthKey(new Date(Date.UTC(year, monthIndex - offset, 1))));
  }
  return keys;
}

/**
 * Running total at each month in the window. Counts before the window stay
 * in the baseline, so the first point is already cumulative.
 */
export function buildCumulativeSeries(
  monthly: MonthlyCount[],
  now: Date,
  months = NETWORK_GROWTH_MONTHS,
): CumulativePoint[] {
  const window = recentMonthKeys(now, months);
  const windowStart = window[0] ?? '';
  const byMonth = new Map<string, number>();
  let baseline = 0;

  for (const entry of monthly) {
    if (!/^\d{4}-\d{2}$/.test(entry.month) || !Number.isFinite(entry.count)) {
      continue;
    }
    if (entry.month < windowStart) {
      baseline += entry.count;
      continue;
    }
    byMonth.set(entry.month, (byMonth.get(entry.month) ?? 0) + entry.count);
  }

  let running = baseline;
  return window.map((month) => {
    running += byMonth.get(month) ?? 0;
    return { month, cumulative: running };
  });
}

export function countInMonth(monthly: MonthlyCount[], now: Date): number {
  const key = toMonthKey(now);
  return monthly.reduce(
    (total, entry) => (entry.month === key ? total + entry.count : total),
    0,
  );
}

export function countCreatedInMonth(
  createdAts: Array<Date | string | null | undefined>,
  now = new Date(),
): number {
  const key = toMonthKey(now);
  let total = 0;
  for (const value of createdAts) {
    if (value == null || value === '') continue;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    if (toMonthKey(date) === key) total += 1;
  }
  return total;
}

function niceStep(value: number): number {
  if (value <= 10) return 1;
  const exponent = 10 ** Math.floor(Math.log10(value));
  return exponent / 2;
}

function niceCeil(value: number): number {
  const step = niceStep(value);
  return Math.ceil(value / step) * step;
}

function niceFloor(value: number): number {
  if (value <= 0) return 0;
  const step = niceStep(value);
  return Math.floor(value / step) * step;
}

/**
 * Zero baseline while the series still has a visible rise. A tight band
 * high on the axis gets a floor just under the earliest point so the
 * month-to-month step stays readable. Tick labels are the real counts.
 */
export function cumulativePlotDomain(values: number[]): {
  min: number;
  max: number;
} {
  const finite = values.filter((value) => Number.isFinite(value));
  const peak = Math.max(0, ...finite);
  const floor = finite.length > 0 ? Math.min(...finite) : 0;
  if (peak <= 0) return { min: 0, max: 1 };

  const span = peak - floor;
  const useZero = floor <= peak * 0.72 || span >= peak * 0.28;
  const min = useZero ? 0 : niceFloor(Math.max(0, floor - span * 0.45));
  let max = niceCeil(Math.max(peak, min + 1));
  if (max <= min) max = min + niceStep(peak);
  return { min, max };
}
