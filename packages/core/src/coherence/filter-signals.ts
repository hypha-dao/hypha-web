import { isSignalDueOverdue } from './signal-due-date';

export type SignalDeadlineFilterMode =
  | 'before'
  | 'after'
  | 'between'
  | 'overdue'
  | 'none';

export type SignalDeadlineFilter =
  | { mode: 'before'; date?: string }
  | { mode: 'after'; date?: string }
  | { mode: 'between'; from?: string; to?: string }
  | { mode: 'overdue' }
  | { mode: 'none' };

export type SignalAssigneeFilter = 'any' | 'me' | number;

export type SignalBoardFilters = {
  title?: string;
  assignee?: SignalAssigneeFilter;
  deadline?: SignalDeadlineFilter;
  tags?: string[];
};

export type FilterableSignal = {
  title?: string | null;
  assigneeIds?: number[] | null;
  dueAt?: Date | string | null;
  tags?: readonly string[] | null;
};

function parseDayStart(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    0,
    0,
    0,
    0,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDayEnd(isoDate: string): Date | null {
  const start = parseDayStart(isoDate);
  if (!start) return null;
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return end;
}

function asDueDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function signalHasTag(signal: FilterableSignal, tag: string): boolean {
  const key = tag.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!key) return true;
  return (signal.tags ?? []).some(
    (candidate) =>
      typeof candidate === 'string' &&
      candidate.trim().replace(/\s+/g, ' ').toLowerCase() === key,
  );
}

function matchesDeadline(
  dueAt: Date | null,
  filter: SignalDeadlineFilter,
  now: Date,
): boolean {
  if (filter.mode === 'none') return dueAt == null;
  if (filter.mode === 'overdue') {
    return dueAt != null && isSignalDueOverdue(dueAt, now.getTime());
  }
  // Incomplete date pickers stay selected without hiding cards yet.
  if (filter.mode === 'before' && !filter.date) return true;
  if (filter.mode === 'after' && !filter.date) return true;
  if (filter.mode === 'between' && !filter.from && !filter.to) return true;
  if (dueAt == null) return false;

  if (filter.mode === 'before') {
    const end = parseDayEnd(filter.date ?? '');
    return end == null || dueAt.getTime() <= end.getTime();
  }
  if (filter.mode === 'after') {
    const start = parseDayStart(filter.date ?? '');
    return start == null || dueAt.getTime() >= start.getTime();
  }
  const from = filter.from ? parseDayStart(filter.from) : null;
  const to = filter.to ? parseDayEnd(filter.to) : null;
  if (!from && !to) return true;
  const time = dueAt.getTime();
  if (from && time < from.getTime()) return false;
  if (to && time > to.getTime()) return false;
  return true;
}

export function hasActiveSignalFilters(filters: SignalBoardFilters): boolean {
  if (filters.title?.trim()) return true;
  if (filters.assignee != null && filters.assignee !== 'any') return true;
  if (filters.deadline) return true;
  if ((filters.tags ?? []).some((tag) => tag.trim().length > 0)) return true;
  return false;
}

export function filterSignals<T extends FilterableSignal>(
  signals: readonly T[],
  filters: SignalBoardFilters,
  options: { currentPersonId?: number | null; now?: Date } = {},
): T[] {
  const title = filters.title?.trim().toLowerCase() ?? '';
  const tags = (filters.tags ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  const now = options.now ?? new Date();

  return signals.filter((signal) => {
    if (title && !(signal.title ?? '').toLowerCase().includes(title)) {
      return false;
    }

    if (filters.assignee != null && filters.assignee !== 'any') {
      const assigneeIds = signal.assigneeIds ?? [];
      if (filters.assignee === 'me') {
        const me = options.currentPersonId;
        if (me == null || !assigneeIds.includes(me)) return false;
      } else if (!assigneeIds.includes(filters.assignee)) {
        return false;
      }
    }

    if (
      filters.deadline &&
      !matchesDeadline(asDueDate(signal.dueAt), filters.deadline, now)
    ) {
      return false;
    }

    if (tags.length > 0 && !tags.every((tag) => signalHasTag(signal, tag))) {
      return false;
    }

    return true;
  });
}
