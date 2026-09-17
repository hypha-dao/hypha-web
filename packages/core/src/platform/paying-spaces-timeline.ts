export const SECONDS_PER_DAY = 86_400;

/** USDC uses 6 decimals; 1 USDC = $1 for space payments. */
export const USDC_DECIMALS = 1_000_000;

/**
 * HyphaToken converts HYPHA → USDC as
 * `(hyphaAmount * HYPHA_PRICE_USD) / (4 * 10^12)`.
 * With the default `HYPHA_PRICE_USD = 1` that is $0.25 per HYPHA.
 */
export const HYPHA_TO_USDC_SCALE = 4n * 10n ** 12n;

/** Contract default when `HYPHA_PRICE_USD()` cannot be read. */
export const DEFAULT_HYPHA_PRICE_USD = 1n;

export type SpacePaymentEvent = {
  timestampSec: number;
  spaceId: number;
  durationDays: number;
  /** USD paid in this event for this space. Missing amounts count as 0. */
  usdAmount?: number;
};

export type CoverageInterval = {
  startSec: number;
  endSec: number;
};

export type PayingSpacesTimelineSpaceSeries = {
  spaceId: number;
  paying: boolean[];
  paymentCount: number[];
  paymentUsd: number[];
};

export type PayingSpacesTimeline = {
  months: string[];
  payingCount: number[];
  paymentCount: number[];
  paymentUsd: number[];
  bySpace: PayingSpacesTimelineSpaceSeries[];
};

export function roundUsd(value: number): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  return Math.round(value * 100) / 100;
}

/** Convert a raw USDC amount (6 decimals) to USD dollars. */
export function usdcAmountToUsd(usdcAmount: bigint): number {
  if (usdcAmount <= 0n) return 0;
  return Number(usdcAmount) / USDC_DECIMALS;
}

/**
 * Convert a raw HYPHA amount (18 decimals) to USD using the on-chain
 * HyphaToken price formula — not a market FX rate.
 */
export function hyphaAmountToUsd(
  hyphaAmount: bigint,
  hyphaPriceUsd: bigint = DEFAULT_HYPHA_PRICE_USD,
): number {
  if (hyphaAmount <= 0n || hyphaPriceUsd <= 0n) return 0;
  const usdcAmount = (hyphaAmount * hyphaPriceUsd) / HYPHA_TO_USDC_SCALE;
  return usdcAmountToUsd(usdcAmount);
}

/**
 * Split a batch payment's USD across spaces in proportion to duration.
 * `SpacesPaymentProcessedWithHypha` only emits total HYPHA, not per-space amounts.
 */
export function allocateUsdByDuration(
  spaceIds: number[],
  durationDays: number[],
  totalUsd: number,
): number[] {
  if (spaceIds.length === 0) return [];
  const roundedTotal = roundUsd(totalUsd);
  if (roundedTotal === 0) return spaceIds.map(() => 0);

  const safeDurations = spaceIds.map((_, index) =>
    Math.max(0, durationDays[index] ?? 0),
  );
  const totalDays = safeDurations.reduce((sum, days) => sum + days, 0);
  if (totalDays <= 0) {
    const share = roundUsd(roundedTotal / spaceIds.length);
    return spaceIds.map(() => share);
  }

  return safeDurations.map((days) =>
    roundUsd(roundedTotal * (days / totalDays)),
  );
}

function parseMonthKey(
  monthKey: string,
): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match?.[1] || !match[2]) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }
  return { year, month };
}

function requireMonthKey(monthKey: string): { year: number; month: number } {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }
  return parsed;
}

/** Previous calendar month key (`YYYY-MM`), or null if the input is invalid. */
export function previousMonthKey(monthKey: string): string | null {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return null;
  const previous = new Date(Date.UTC(parsed.year, parsed.month - 2, 1));
  return toMonthKey(previous);
}

export function toMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function nextMonthKey(monthKey: string): string {
  const { year, month } = requireMonthKey(monthKey);
  const next = new Date(Date.UTC(year, month, 1));
  return toMonthKey(next);
}

export function monthKeyToStartSec(monthKey: string): number {
  const { year, month } = requireMonthKey(monthKey);
  return Math.floor(Date.UTC(year, month - 1, 1) / 1000);
}

export function enumerateMonthKeys(
  fromKey: string,
  toKey: string,
  maxMonths = 240,
): string[] {
  if (!fromKey || !toKey || fromKey > toKey) return [];
  if (!parseMonthKey(fromKey) || !parseMonthKey(toKey)) return [];
  const keys: string[] = [];
  let cursor = fromKey;
  while (cursor <= toKey && keys.length < maxMonths) {
    keys.push(cursor);
    cursor = nextMonthKey(cursor);
  }
  return keys;
}

/**
 * Replay `updateSpacePayment` coverage: expired payments restart from the
 * event timestamp; still-active payments extend the current expiry.
 */
export function reconstructCoverage(
  events: SpacePaymentEvent[],
): Map<number, CoverageInterval[]> {
  const sorted = [...events].sort(
    (a, b) => a.timestampSec - b.timestampSec || a.spaceId - b.spaceId,
  );
  const expiryBySpace = new Map<number, number>();
  const intervals = new Map<number, CoverageInterval[]>();

  for (const event of sorted) {
    if (event.durationDays <= 0 || event.timestampSec <= 0) continue;
    const addedSec = event.durationDays * SECONDS_PER_DAY;
    const currentExpiry = expiryBySpace.get(event.spaceId) ?? 0;
    const stillActive = currentExpiry >= event.timestampSec;
    const newExpiry =
      (stillActive ? currentExpiry : event.timestampSec) + addedSec;
    const list = intervals.get(event.spaceId) ?? [];
    const last = list.at(-1);

    if (last && stillActive) {
      last.endSec = newExpiry;
    } else {
      list.push({ startSec: event.timestampSec, endSec: newExpiry });
    }

    intervals.set(event.spaceId, list);
    expiryBySpace.set(event.spaceId, newExpiry);
  }

  return intervals;
}

export function coverageOverlapsMonth(
  intervals: CoverageInterval[],
  monthKey: string,
): boolean {
  const start = monthKeyToStartSec(monthKey);
  const end = monthKeyToStartSec(nextMonthKey(monthKey));
  return intervals.some(
    (interval) => interval.startSec < end && interval.endSec > start,
  );
}

export function buildPayingSpacesTimeline(input: {
  events: SpacePaymentEvent[];
  nowSec: number;
}): PayingSpacesTimeline {
  const validEvents = input.events.filter(
    (event) => event.timestampSec > 0 && event.durationDays > 0,
  );
  if (validEvents.length === 0) {
    return {
      months: [],
      payingCount: [],
      paymentCount: [],
      paymentUsd: [],
      bySpace: [],
    };
  }

  const coverage = reconstructCoverage(validEvents);
  const firstTs = Math.min(...validEvents.map((event) => event.timestampSec));
  const fromKey = toMonthKey(new Date(firstTs * 1000));
  const toKey = toMonthKey(new Date(input.nowSec * 1000));
  const months = enumerateMonthKeys(fromKey, toKey);
  const spaceIds = [...coverage.keys()].sort((a, b) => a - b);

  const paymentsBySpaceMonth = new Map<string, number>();
  const paymentUsdBySpaceMonth = new Map<string, number>();
  for (const event of validEvents) {
    const month = toMonthKey(new Date(event.timestampSec * 1000));
    const key = `${event.spaceId}|${month}`;
    paymentsBySpaceMonth.set(key, (paymentsBySpaceMonth.get(key) ?? 0) + 1);
    paymentUsdBySpaceMonth.set(
      key,
      roundUsd((paymentUsdBySpaceMonth.get(key) ?? 0) + (event.usdAmount ?? 0)),
    );
  }

  const bySpace: PayingSpacesTimelineSpaceSeries[] = spaceIds.map((spaceId) => {
    const intervals = coverage.get(spaceId) ?? [];
    return {
      spaceId,
      paying: months.map((month) => coverageOverlapsMonth(intervals, month)),
      paymentCount: months.map(
        (month) => paymentsBySpaceMonth.get(`${spaceId}|${month}`) ?? 0,
      ),
      paymentUsd: months.map(
        (month) => paymentUsdBySpaceMonth.get(`${spaceId}|${month}`) ?? 0,
      ),
    };
  });

  return {
    months,
    payingCount: months.map((_, index) =>
      bySpace.reduce((sum, series) => sum + (series.paying[index] ? 1 : 0), 0),
    ),
    paymentCount: months.map((_, index) =>
      bySpace.reduce(
        (sum, series) => sum + (series.paymentCount[index] ?? 0),
        0,
      ),
    ),
    paymentUsd: months.map((_, index) =>
      roundUsd(
        bySpace.reduce(
          (sum, series) => sum + (series.paymentUsd[index] ?? 0),
          0,
        ),
      ),
    ),
    bySpace,
  };
}
