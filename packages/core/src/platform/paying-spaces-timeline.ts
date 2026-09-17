export const SECONDS_PER_DAY = 86_400;

export type SpacePaymentEvent = {
  timestampSec: number;
  spaceId: number;
  durationDays: number;
};

export type CoverageInterval = {
  startSec: number;
  endSec: number;
};

export type PayingSpacesTimelineSpaceSeries = {
  spaceId: number;
  paying: boolean[];
  paymentCount: number[];
};

export type PayingSpacesTimeline = {
  months: string[];
  payingCount: number[];
  paymentCount: number[];
  bySpace: PayingSpacesTimelineSpaceSeries[];
};

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
    return { months: [], payingCount: [], paymentCount: [], bySpace: [] };
  }

  const coverage = reconstructCoverage(validEvents);
  const firstTs = Math.min(...validEvents.map((event) => event.timestampSec));
  const fromKey = toMonthKey(new Date(firstTs * 1000));
  const toKey = toMonthKey(new Date(input.nowSec * 1000));
  const months = enumerateMonthKeys(fromKey, toKey);
  const spaceIds = [...coverage.keys()].sort((a, b) => a - b);

  const paymentsBySpaceMonth = new Map<string, number>();
  for (const event of validEvents) {
    const month = toMonthKey(new Date(event.timestampSec * 1000));
    const key = `${event.spaceId}|${month}`;
    paymentsBySpaceMonth.set(key, (paymentsBySpaceMonth.get(key) ?? 0) + 1);
  }

  const bySpace: PayingSpacesTimelineSpaceSeries[] = spaceIds.map((spaceId) => {
    const intervals = coverage.get(spaceId) ?? [];
    return {
      spaceId,
      paying: months.map((month) => coverageOverlapsMonth(intervals, month)),
      paymentCount: months.map(
        (month) => paymentsBySpaceMonth.get(`${spaceId}|${month}`) ?? 0,
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
    bySpace,
  };
}
