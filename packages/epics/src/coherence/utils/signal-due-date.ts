/** Due dates are day-level; overdue only after the due calendar day ends. */
export function isSignalDueOverdue(dueDate: Date, now = Date.now()): boolean {
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
