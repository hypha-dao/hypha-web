const ENGLISH_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type QuestCalendarDate = {
  year: number;
  month: number;
  day: number;
};

/**
 * Calendar date only. `YYYY-MM-DD` and a leading date on an ISO timestamp use
 * those numbers, so a UTC midnight value cannot move the day.
 */
export function parseQuestCalendarDate(
  value: string | null | undefined,
): QuestCalendarDate | null {
  const text = value?.trim() ?? '';
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(text);
  if (iso?.[1] && iso[2] && iso[3]) {
    return validCalendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const named = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?,?\s+(\d{4})$/.exec(
    text,
  );
  if (!named?.[1] || !named[2] || !named[3]) return null;
  const month = monthIndex(named[2]);
  if (month == null) return null;
  return validCalendarDate(Number(named[3]), month, Number(named[1]));
}

function monthIndex(name: string): number | null {
  const lower = name.toLowerCase();
  const index = ENGLISH_MONTHS.findIndex(
    (month) =>
      month.toLowerCase() === lower ||
      month.slice(0, 3).toLowerCase() === lower.slice(0, 3),
  );
  return index >= 0 ? index + 1 : null;
}

function validCalendarDate(
  year: number,
  month: number,
  day: number,
): QuestCalendarDate | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  if (year < 2000 || year > 2100) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Display a quest date as day, full month, year.
 * English stays `20 November 2026`. Other locales use the same calendar day
 * with `month: long`, formatted in UTC so the day does not shift.
 * Text that is not a calendar date is returned unchanged.
 */
export function formatQuestCalendarDate(
  value: string | null | undefined,
  locale = 'en',
): string {
  const parsed = parseQuestCalendarDate(value);
  if (!parsed) return value?.trim() ?? '';
  const utc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  const language = locale.trim() || 'en';
  if (language.toLowerCase().startsWith('en')) {
    return `${parsed.day} ${ENGLISH_MONTHS[parsed.month - 1]} ${parsed.year}`;
  }
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utc);
}
