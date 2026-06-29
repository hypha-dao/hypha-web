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

export function buildRecurrenceRuleFromPreset(
  preset: RecurrencePreset,
  startsAt: Date,
): string | null {
  if (preset === 'none') return null;

  const day = WEEKDAY_MAP[startsAt.getDay()];
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

function createRecurrenceRule(startsAt: Date, recurrenceRule: string): RRule {
  const normalized = recurrenceRule.trim().toUpperCase();
  const dtstart = new Date(startsAt);

  if (normalized === 'FREQ=DAILY') {
    return new RRule({ freq: RRule.DAILY, dtstart });
  }

  if (normalized.startsWith('FREQ=WEEKLY')) {
    const bydayMatch = normalized.match(/BYDAY=([A-Z,]+)/);
    const byweekday =
      bydayMatch && bydayMatch[1]
        ? parseBydayTokens(bydayMatch[1])
        : [RRULE_WEEKDAY[WEEKDAY_MAP[dtstart.getDay()]]];
    return new RRule({ freq: RRule.WEEKLY, dtstart, byweekday });
  }

  if (normalized === 'FREQ=MONTHLY') {
    return new RRule({ freq: RRule.MONTHLY, dtstart });
  }

  if (normalized === 'FREQ=YEARLY') {
    return new RRule({ freq: RRule.YEARLY, dtstart });
  }

  throw new Error(`Unsupported recurrence rule: ${recurrenceRule}`);
}

export function expandScheduledOccurrenceStarts({
  startsAt,
  recurrenceRule,
  recurrenceUntil,
  from,
  to,
}: {
  startsAt: Date;
  recurrenceRule?: string | null;
  recurrenceUntil?: Date | null;
  from: Date;
  to: Date;
}): Date[] {
  if (!recurrenceRule?.trim()) {
    if (startsAt >= from && startsAt <= to) return [startsAt];
    return [];
  }

  try {
    const rule = createRecurrenceRule(startsAt, recurrenceRule);
    const until = recurrenceUntil ?? to;
    return rule.between(from, until > to ? to : until, true);
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
}) {
  if (!item.recurrenceRule?.trim()) return null;

  return {
    dtstart: item.startsAt.toISOString(),
    ...(item.recurrenceUntil
      ? { until: item.recurrenceUntil.toISOString() }
      : {}),
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
