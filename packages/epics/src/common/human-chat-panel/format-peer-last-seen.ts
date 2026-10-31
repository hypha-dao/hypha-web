/** Calendar day key in the local timezone. */
function dayKeyLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Calendar day key in an IANA timezone (matches NextIntlClientProvider). */
function dayKeyInTimeZone(date: Date, timeZone?: string): string {
  if (!timeZone) return dayKeyLocal(date);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = parts.find((part) => part.type === 'year')?.value;
    const m = parts.find((part) => part.type === 'month')?.value;
    const d = parts.find((part) => part.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Invalid zone — fall back to local.
  }
  return dayKeyLocal(date);
}

/** Shift a `YYYY-MM-DD` civil date by whole calendar days. */
function shiftDayKey(key: string, deltaDays: number): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  const shifted = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export type PeerLastSeenFormatParts =
  | { key: 'online' }
  | { key: 'lastSeenToday'; time: string }
  | { key: 'lastSeenYesterday'; time: string }
  | { key: 'lastSeenDate'; date: string; time: string };

/**
 * Pick the i18n shape for a DM last-seen line. Caller supplies localized
 * time/date strings from `useFormatter`. Pass the same `timeZone` the
 * formatter uses so "today" / "yesterday" match the displayed clock.
 */
export function peerLastSeenFormatParts(
  at: number,
  formatTime: (date: Date) => string,
  formatDate: (date: Date) => string,
  now = new Date(),
  timeZone?: string,
): PeerLastSeenFormatParts {
  const when = new Date(at);
  if (!Number.isFinite(at) || at <= 0) return { key: 'online' };
  const time = formatTime(when);
  const today = dayKeyInTimeZone(now, timeZone);
  const whenKey = dayKeyInTimeZone(when, timeZone);
  if (whenKey === today) return { key: 'lastSeenToday', time };
  if (whenKey === shiftDayKey(today, -1)) {
    return { key: 'lastSeenYesterday', time };
  }
  return { key: 'lastSeenDate', date: formatDate(when), time };
}
