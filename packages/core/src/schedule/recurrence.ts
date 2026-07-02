import { RRule, type Weekday } from 'rrule';
import type { RecurrencePreset } from './recurrence-presets';

const WEEKDAY_MAP = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

const RRULE_WEEKDAY: Record<(typeof WEEKDAY_MAP)[number], Weekday> = {
  SU: RRule.SU,
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
};

const WEEKDAY_SHORT_TO_RRULE: Record<string, (typeof WEEKDAY_MAP)[number]> = {
  Sun: 'SU',
  Mon: 'MO',
  Tue: 'TU',
  Wed: 'WE',
  Thu: 'TH',
  Fri: 'FR',
  Sat: 'SA',
};

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function isValidTimezone(
  timezone: string | null | undefined,
): timezone is string {
  if (!timezone?.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone.trim() });
    return true;
  } catch {
    return false;
  }
}

function getWallClockInTimezone(date: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const hour = get('hour') % 24;

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
  };
}

function wallClockToFloatingDate(parts: WallClock): Date {
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

function floatingDateToWallClock(date: Date): WallClock {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  };
}

function zonedTimeToUtc(parts: WallClock, timeZone: string): Date {
  const pad = (value: number) => String(value).padStart(2, '0');
  const iso = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(
    parts.hour,
  )}:${pad(parts.minute)}:${pad(parts.second)}`;

  const TemporalRef = (
    globalThis as {
      Temporal?: {
        ZonedDateTime: {
          from(value: string): { epochMilliseconds: number };
        };
      };
    }
  ).Temporal;
  if (TemporalRef) {
    try {
      return new Date(
        TemporalRef.ZonedDateTime.from(`${iso}[${timeZone}]`).epochMilliseconds,
      );
    } catch {
      // fall through to iterative fallback
    }
  }

  let timestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  for (let attempt = 0; attempt < 4; attempt++) {
    const actual = getWallClockInTimezone(new Date(timestamp), timeZone);
    if (
      actual.year === parts.year &&
      actual.month === parts.month &&
      actual.day === parts.day &&
      actual.hour === parts.hour &&
      actual.minute === parts.minute &&
      actual.second === parts.second
    ) {
      return new Date(timestamp);
    }

    timestamp +=
      ((parts.day - actual.day) * 86_400 +
        (parts.hour - actual.hour) * 3_600 +
        (parts.minute - actual.minute) * 60 +
        (parts.second - actual.second)) *
      1_000;
  }

  return new Date(timestamp);
}

function getWeekdayInTimezone(
  date: Date,
  timeZone: string,
): (typeof WEEKDAY_MAP)[number] {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(date);
  return WEEKDAY_SHORT_TO_RRULE[weekday] ?? 'SU';
}

function resolveDtstart(startsAt: Date, timezone?: string | null): Date {
  if (isValidTimezone(timezone)) {
    return wallClockToFloatingDate(getWallClockInTimezone(startsAt, timezone));
  }
  return new Date(startsAt);
}

function resolveRruleOptions(
  startsAt: Date,
  timezone?: string | null,
): { dtstart: Date; tzid?: string } {
  const dtstart = resolveDtstart(startsAt, timezone);
  if (isValidTimezone(timezone)) {
    return { dtstart, tzid: timezone.trim() };
  }
  return { dtstart };
}

export function buildRecurrenceRuleFromPreset(
  preset: RecurrencePreset,
  startsAt: Date,
  timezone?: string | null,
): string | null {
  if (preset === 'none') return null;

  const day = isValidTimezone(timezone)
    ? getWeekdayInTimezone(startsAt, timezone)
    : WEEKDAY_MAP[startsAt.getDay()] ?? 'SU';

  switch (preset) {
    case 'daily':
      return 'FREQ=DAILY';
    case 'weekly':
      return `FREQ=WEEKLY;BYDAY=${day}`;
    case 'monthly':
      return 'FREQ=MONTHLY';
    case 'yearly':
      return 'FREQ=YEARLY';
    default:
      return null;
  }
}

export function detectRecurrencePreset(
  recurrenceRule: string | null | undefined,
): RecurrencePreset {
  const normalized = recurrenceRule?.trim().toUpperCase();
  if (!normalized) return 'none';
  if (normalized === 'FREQ=DAILY') return 'daily';
  if (normalized.startsWith('FREQ=WEEKLY')) return 'weekly';
  if (normalized === 'FREQ=MONTHLY') return 'monthly';
  if (normalized === 'FREQ=YEARLY') return 'yearly';
  return 'none';
}

function parseBydayTokens(value: string): Weekday[] {
  return value
    .split(',')
    .map((token) => token.trim().toUpperCase())
    .filter((token): token is (typeof WEEKDAY_MAP)[number] =>
      (WEEKDAY_MAP as readonly string[]).includes(token),
    )
    .map((token) => RRULE_WEEKDAY[token]);
}

function createRecurrenceRule(
  startsAt: Date,
  recurrenceRule: string,
  timezone?: string | null,
): RRule {
  const normalized = recurrenceRule.trim().toUpperCase();
  const { dtstart, tzid } = resolveRruleOptions(startsAt, timezone);

  if (normalized === 'FREQ=DAILY') {
    return new RRule({ freq: RRule.DAILY, dtstart, ...(tzid ? { tzid } : {}) });
  }

  if (normalized.startsWith('FREQ=WEEKLY')) {
    const bydayMatch = normalized.match(/BYDAY=([A-Z,]+)/);
    const fallbackDay = isValidTimezone(timezone)
      ? getWeekdayInTimezone(startsAt, timezone)
      : WEEKDAY_MAP[dtstart.getDay()] ?? 'SU';
    const byweekday = bydayMatch?.[1]
      ? parseBydayTokens(bydayMatch[1])
      : [RRULE_WEEKDAY[fallbackDay]];
    return new RRule({
      freq: RRule.WEEKLY,
      dtstart,
      byweekday,
      ...(tzid ? { tzid } : {}),
    });
  }

  if (normalized === 'FREQ=MONTHLY') {
    return new RRule({
      freq: RRule.MONTHLY,
      dtstart,
      ...(tzid ? { tzid } : {}),
    });
  }

  if (normalized === 'FREQ=YEARLY') {
    return new RRule({
      freq: RRule.YEARLY,
      dtstart,
      ...(tzid ? { tzid } : {}),
    });
  }

  throw new Error(`Unsupported recurrence rule: ${recurrenceRule}`);
}

export function expandScheduledOccurrenceStarts({
  startsAt,
  recurrenceRule,
  recurrenceUntil,
  from,
  to,
  timezone,
}: {
  startsAt: Date;
  recurrenceRule?: string | null;
  recurrenceUntil?: Date | null;
  from: Date;
  to: Date;
  timezone?: string | null;
}): Date[] {
  if (!recurrenceRule?.trim()) {
    if (startsAt >= from && startsAt <= to) return [startsAt];
    return [];
  }

  try {
    const rule = createRecurrenceRule(startsAt, recurrenceRule, timezone);
    const until = recurrenceUntil ?? to;
    const untilBound = until > to ? to : until;

    if (isValidTimezone(timezone)) {
      const rangeFrom = wallClockToFloatingDate(
        getWallClockInTimezone(from, timezone),
      );
      const rangeTo = wallClockToFloatingDate(
        getWallClockInTimezone(untilBound, timezone),
      );

      return rule
        .between(rangeFrom, rangeTo, true)
        .map((occurrence) =>
          zonedTimeToUtc(floatingDateToWallClock(occurrence), timezone),
        )
        .filter((occurrence) => occurrence >= from && occurrence <= untilBound);
    }

    return rule.between(from, untilBound, true);
  } catch {
    if (startsAt >= from && startsAt <= to) return [startsAt];
    return [];
  }
}

export function toRruleDtstart(date: Date): string {
  const pad = (value: number, len = 2) => String(value).padStart(len, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export function getEventDurationMs(startsAt: Date, endsAt: Date): number {
  return Math.max(0, endsAt.getTime() - startsAt.getTime());
}

export function toFullCalendarRruleInput(item: {
  startsAt: Date;
  endsAt: Date;
  recurrenceRule?: string | null;
  recurrenceUntil?: Date | null;
  timezone?: string | null;
}) {
  if (!item.recurrenceRule?.trim()) return null;

  const tzid = isValidTimezone(item.timezone)
    ? item.timezone.trim()
    : undefined;
  const dtstartDate = tzid
    ? wallClockToFloatingDate(getWallClockInTimezone(item.startsAt, tzid))
    : new Date(item.startsAt);
  const untilDate =
    item.recurrenceUntil && tzid
      ? wallClockToFloatingDate(
          getWallClockInTimezone(item.recurrenceUntil, tzid),
        )
      : item.recurrenceUntil;

  return {
    dtstart: toRruleDtstart(dtstartDate),
    ...(untilDate ? { until: toRruleDtstart(untilDate) } : {}),
    ...(tzid ? { tzid } : {}),
    ...parseRruleParts(item.recurrenceRule),
  };
}

function parseRruleParts(rule: string): Record<string, unknown> {
  const parts = rule.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split('=');
    if (key && value) acc[key.toLowerCase()] = value;
    return acc;
  }, {});

  const output: Record<string, unknown> = {};
  if (parts.freq) output.freq = parts.freq.toLowerCase();
  if (parts.interval) output.interval = Number.parseInt(parts.interval, 10);
  if (parts.byday) {
    output.byweekday = parts.byday.split(',').map((day) => day.toLowerCase());
  }
  if (parts.count) output.count = Number.parseInt(parts.count, 10);
  return output;
}
