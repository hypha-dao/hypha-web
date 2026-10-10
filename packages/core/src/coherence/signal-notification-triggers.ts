import { isSignalDueOverdue } from './signal-due-date';

export type SignalDeadlineNotifyState = {
  dueAtIso?: string | null;
  reminderSentAt?: string | null;
  overdueSentAt?: string | null;
};

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

function dueAtMs(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isNaN(ms) ? null : ms;
}

function dueAtIso(value: Date | string | null | undefined): string | null {
  const ms = dueAtMs(value);
  return ms == null ? null : new Date(ms).toISOString();
}

export function newlyAssignedPersonIds(
  previousIds: readonly number[] | null | undefined,
  nextIds: readonly number[] | null | undefined,
): number[] {
  const previous = new Set(previousIds ?? []);
  return [...new Set(nextIds ?? [])].filter(
    (id) => Number.isInteger(id) && id > 0 && !previous.has(id),
  );
}

export function dueAtHasChanged(
  previous: Date | string | null | undefined,
  next: Date | string | null | undefined,
): boolean {
  return dueAtIso(previous) !== dueAtIso(next);
}

export function resetDeadlineNotifyState(
  nextDueAt: Date | string | null | undefined,
  previous: SignalDeadlineNotifyState | null | undefined = {},
): SignalDeadlineNotifyState {
  const nextIso = dueAtIso(nextDueAt);
  if (nextIso && nextIso === previous?.dueAtIso) {
    return {
      dueAtIso: nextIso,
      reminderSentAt: previous.reminderSentAt ?? null,
      overdueSentAt: previous.overdueSentAt ?? null,
    };
  }
  return {
    dueAtIso: nextIso,
    reminderSentAt: null,
    overdueSentAt: null,
  };
}

export function shouldSendDeadlineReminder(
  dueAt: Date | string | null | undefined,
  state: SignalDeadlineNotifyState | null | undefined,
  now: Date = new Date(),
): boolean {
  const due = dueAtMs(dueAt);
  if (due == null) return false;
  const dueDate = new Date(due);
  if (isSignalDueOverdue(dueDate, now.getTime())) return false;
  const endOfDueDay = new Date(dueDate);
  endOfDueDay.setHours(23, 59, 59, 999);
  const remaining = endOfDueDay.getTime() - now.getTime();
  if (remaining > REMINDER_WINDOW_MS || remaining < 0) return false;
  const currentIso = dueAtIso(dueDate);
  if (state?.dueAtIso === currentIso && state.reminderSentAt) return false;
  return true;
}

export function shouldSendOverdueAlert(
  dueAt: Date | string | null | undefined,
  state: SignalDeadlineNotifyState | null | undefined,
  now: Date = new Date(),
): boolean {
  const due = dueAtMs(dueAt);
  if (due == null) return false;
  const dueDate = new Date(due);
  if (!isSignalDueOverdue(dueDate, now.getTime())) return false;
  const currentIso = dueAtIso(dueDate);
  if (state?.dueAtIso === currentIso && state.overdueSentAt) return false;
  return true;
}

export function markDeadlineReminderSent(
  dueAt: Date | string,
  now: Date = new Date(),
): SignalDeadlineNotifyState {
  return {
    dueAtIso: dueAtIso(dueAt),
    reminderSentAt: now.toISOString(),
    overdueSentAt: null,
  };
}

export function markDeadlineOverdueSent(
  dueAt: Date | string,
  previous: SignalDeadlineNotifyState | null | undefined = {},
  now: Date = new Date(),
): SignalDeadlineNotifyState {
  return {
    dueAtIso: dueAtIso(dueAt),
    reminderSentAt: previous?.reminderSentAt ?? null,
    overdueSentAt: now.toISOString(),
  };
}

export function assigneeAcknowledgementMap(
  assigneeIds: readonly number[],
  previous: Record<string, string> | null | undefined,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const id of assigneeIds) {
    const key = String(id);
    if (previous?.[key]) next[key] = previous[key];
  }
  return next;
}

export function hasAssigneeAcknowledged(
  assigneeIds: readonly number[] | null | undefined,
  acknowledgements: Record<string, string> | null | undefined,
): boolean {
  const ids = (assigneeIds ?? []).filter(
    (id) => Number.isInteger(id) && id > 0,
  );
  if (ids.length === 0) return false;
  return ids.every((id) => Boolean(acknowledgements?.[String(id)]));
}
