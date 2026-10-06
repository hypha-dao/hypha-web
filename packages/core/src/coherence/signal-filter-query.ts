import type {
  SignalAssigneeFilter,
  SignalBoardFilters,
  SignalDeadlineFilter,
  SignalDeadlineFilterMode,
} from './filter-signals';

export const SIGNAL_FILTER_QUERY_KEYS = {
  title: 'title',
  assignee: 'assignee',
  deadline: 'deadline',
  deadlineFrom: 'deadlineFrom',
  deadlineTo: 'deadlineTo',
  tags: 'tags',
} as const;

const DEADLINE_MODES: readonly SignalDeadlineFilterMode[] = [
  'before',
  'after',
  'between',
  'overdue',
  'none',
];

function isDeadlineMode(value: string): value is SignalDeadlineFilterMode {
  return (DEADLINE_MODES as readonly string[]).includes(value);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseAssignee(raw: string | null): SignalAssigneeFilter | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value || value === 'any') return undefined;
  if (value === 'me') return 'me';
  const id = Number.parseInt(value, 10);
  if (Number.isInteger(id) && id > 0) return id;
  return undefined;
}

function parseDeadline(
  params: URLSearchParams,
): SignalDeadlineFilter | undefined {
  const modeRaw = params.get(SIGNAL_FILTER_QUERY_KEYS.deadline)?.trim() ?? '';
  if (!modeRaw || !isDeadlineMode(modeRaw)) return undefined;
  if (modeRaw === 'overdue' || modeRaw === 'none') return { mode: modeRaw };
  const fromRaw =
    params.get(SIGNAL_FILTER_QUERY_KEYS.deadlineFrom)?.trim() ?? '';
  const toRaw = params.get(SIGNAL_FILTER_QUERY_KEYS.deadlineTo)?.trim() ?? '';
  const from = isIsoDate(fromRaw) ? fromRaw : undefined;
  const to = isIsoDate(toRaw) ? toRaw : undefined;
  if (modeRaw === 'before') {
    return to ? { mode: 'before', date: to } : { mode: 'before' };
  }
  if (modeRaw === 'after') {
    return from ? { mode: 'after', date: from } : { mode: 'after' };
  }
  if (modeRaw === 'between') {
    return {
      mode: 'between',
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    };
  }
  return undefined;
}

export function parseSignalBoardFilters(
  search: string | URLSearchParams,
): SignalBoardFilters {
  const params =
    typeof search === 'string' ? new URLSearchParams(search) : search;
  const title = params.get(SIGNAL_FILTER_QUERY_KEYS.title)?.trim() || undefined;
  const assignee = parseAssignee(params.get(SIGNAL_FILTER_QUERY_KEYS.assignee));
  const deadline = parseDeadline(params);
  const tags = (params.get(SIGNAL_FILTER_QUERY_KEYS.tags) ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return {
    ...(title ? { title } : {}),
    ...(assignee ? { assignee } : {}),
    ...(deadline ? { deadline } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  };
}

export function writeSignalBoardFilters(
  current: string | URLSearchParams,
  filters: SignalBoardFilters,
): URLSearchParams {
  const next = new URLSearchParams(
    typeof current === 'string' ? current : current.toString(),
  );
  for (const key of Object.values(SIGNAL_FILTER_QUERY_KEYS)) {
    next.delete(key);
  }

  const title = filters.title?.trim();
  if (title) next.set(SIGNAL_FILTER_QUERY_KEYS.title, title);

  if (filters.assignee != null && filters.assignee !== 'any') {
    next.set(SIGNAL_FILTER_QUERY_KEYS.assignee, String(filters.assignee));
  }

  if (filters.deadline) {
    next.set(SIGNAL_FILTER_QUERY_KEYS.deadline, filters.deadline.mode);
    if (filters.deadline.mode === 'before' && filters.deadline.date) {
      next.set(SIGNAL_FILTER_QUERY_KEYS.deadlineTo, filters.deadline.date);
    } else if (filters.deadline.mode === 'after' && filters.deadline.date) {
      next.set(SIGNAL_FILTER_QUERY_KEYS.deadlineFrom, filters.deadline.date);
    } else if (filters.deadline.mode === 'between') {
      if (filters.deadline.from) {
        next.set(SIGNAL_FILTER_QUERY_KEYS.deadlineFrom, filters.deadline.from);
      }
      if (filters.deadline.to) {
        next.set(SIGNAL_FILTER_QUERY_KEYS.deadlineTo, filters.deadline.to);
      }
    }
  }

  const tags = (filters.tags ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  if (tags.length > 0) {
    next.set(SIGNAL_FILTER_QUERY_KEYS.tags, tags.join(','));
  }

  return next;
}

export function clearSignalBoardFilters(
  current: string | URLSearchParams,
): URLSearchParams {
  return writeSignalBoardFilters(current, {});
}
