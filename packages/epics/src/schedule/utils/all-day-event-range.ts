export function startOfLocalCalendarDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfLocalCalendarDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

/** Normalize stored all-day ranges for calendar display and form round-trips. */
export function normalizeAllDayEventRange(
  start: Date,
  end: Date | null,
): { startsAt: Date; endsAt: Date } {
  const startsAt = startOfLocalCalendarDay(start);
  let endsAt = end ? new Date(end) : new Date(startsAt);
  endsAt = new Date(endsAt.getTime() - 86_400_000);
  return {
    startsAt,
    endsAt: endOfLocalCalendarDay(endsAt),
  };
}

export function fromAllDayStartLocalValue(value: string): Date {
  return startOfLocalCalendarDay(new Date(`${value.slice(0, 10)}T00:00:00`));
}

export function fromAllDayEndLocalValue(value: string): Date {
  return endOfLocalCalendarDay(new Date(`${value.slice(0, 10)}T00:00:00`));
}

export function toAllDayEndLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T23:59`;
}
