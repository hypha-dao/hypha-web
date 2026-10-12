/** Due dates are day-level; overdue only after the due calendar day ends. */
export function isSignalDueOverdue(
  dueDate: Date,
  now: number = Date.now(),
): boolean {
  const endOfDueDay = new Date(dueDate);
  endOfDueDay.setHours(23, 59, 59, 999);
  return now > endOfDueDay.getTime();
}

export function toLocalDueDateInputValue(
  dueAt: Date | null | undefined,
): string {
  if (!dueAt) return '';
  const date = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dueDateFromInputValue(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatSignalDueDateLabel(
  dueAt: Date | string | null | undefined,
): string | null {
  if (dueAt == null) return null;
  const date = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
