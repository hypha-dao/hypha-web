/** Shared Intl options for full date-time display in the user's locale. */
export const LOCAL_DATE_TIME_FORMAT_OPTIONS = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
} as const satisfies Intl.DateTimeFormatOptions;

export const LOCAL_DATE_FORMAT_OPTIONS = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
} as const satisfies Intl.DateTimeFormatOptions;

const FALLBACK_TIME_ZONE = 'UTC';

/** Returns true when `value` looks like a valid IANA timezone identifier. */
export function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Browser-only: resolves the user's IANA timezone. Falls back to UTC on the server. */
export function getBrowserTimeZone(): string {
  if (typeof Intl === 'undefined') {
    return FALLBACK_TIME_ZONE;
  }

  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(resolved) ? resolved : FALLBACK_TIME_ZONE;
}

export function parseDateInput(
  dateInput: string | number | Date,
): Date | null {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Locale-aware formatting using the user's timezone (defaults to browser local time). */
export function formatLocalDateTime(
  dateInput: string | number | Date,
  options: {
    locale?: string;
    timeZone?: string;
    withTime?: boolean;
  } = {},
): string {
  const date = parseDateInput(dateInput);
  if (!date) {
    throw new Error('Invalid date input');
  }

  const { locale, timeZone, withTime = false } = options;
  const formatOptions: Intl.DateTimeFormatOptions = withTime
    ? LOCAL_DATE_TIME_FORMAT_OPTIONS
    : LOCAL_DATE_FORMAT_OPTIONS;

  return new Intl.DateTimeFormat(locale, {
    ...formatOptions,
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}
