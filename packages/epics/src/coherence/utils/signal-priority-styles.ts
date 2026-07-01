export const PRIORITY_ACCENT_BAR: Record<string, string> = {
  critical: 'bg-error-9',
  high: 'bg-warning-9',
  medium: 'bg-accent-9',
  low: 'bg-neutral-8',
};

export const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-error-9 ring-error-9/25',
  high: 'bg-warning-9 ring-warning-9/25',
  medium: 'bg-accent-9 ring-accent-9/25',
  low: 'bg-neutral-8 ring-neutral-8/25',
};

export function priorityAccentClass(priority?: string | null): string {
  const key = priority ?? 'medium';
  return PRIORITY_ACCENT_BAR[key] ?? PRIORITY_ACCENT_BAR.medium!;
}

export function priorityDotClass(priority?: string | null): string {
  const key = priority ?? 'medium';
  return PRIORITY_DOT[key] ?? PRIORITY_DOT.medium!;
}

export const STATUS_COLUMN_DOTS = [
  'bg-neutral-9',
  'bg-accent-9',
  'bg-warning-9',
  'bg-success-9',
  'bg-error-9',
] as const;

export function statusColumnDotClass(index: number): string {
  return STATUS_COLUMN_DOTS[index % STATUS_COLUMN_DOTS.length] ?? 'bg-neutral-9';
}
