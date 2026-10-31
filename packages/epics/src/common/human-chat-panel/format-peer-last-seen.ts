/** Calendar day key in the local timezone. */
function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type PeerLastSeenFormatParts =
  | { key: 'online' }
  | { key: 'lastSeenToday'; time: string }
  | { key: 'lastSeenYesterday'; time: string }
  | { key: 'lastSeenDate'; date: string; time: string };

/**
 * Pick the i18n shape for a DM last-seen line. Caller supplies localized
 * time/date strings from `useFormatter`.
 */
export function peerLastSeenFormatParts(
  at: number,
  formatTime: (date: Date) => string,
  formatDate: (date: Date) => string,
  now = new Date(),
): PeerLastSeenFormatParts {
  const when = new Date(at);
  if (!Number.isFinite(at) || at <= 0) return { key: 'online' };
  const time = formatTime(when);
  const today = dayKey(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const whenKey = dayKey(when);
  if (whenKey === today) return { key: 'lastSeenToday', time };
  if (whenKey === dayKey(yesterdayDate)) {
    return { key: 'lastSeenYesterday', time };
  }
  return { key: 'lastSeenDate', date: formatDate(when), time };
}
