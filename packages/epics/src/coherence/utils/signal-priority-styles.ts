const WORKFLOW_COLOR_DOT: Record<string, string> = {
  neutral: 'bg-neutral-9',
  accent: 'bg-accent-9',
  warn: 'bg-warning-9',
  warning: 'bg-warning-9',
  success: 'bg-success-9',
  error: 'bg-error-9',
};

export const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-error-9 ring-error-9/25',
  high: 'bg-warning-9 ring-warning-9/25',
  medium: 'bg-accent-9 ring-accent-9/25',
  low: 'bg-neutral-8 ring-neutral-8/25',
};

/** @deprecated Prefer statusColorDotClass — index-based dots clash with priority colors. */
export function statusColumnDotClass(index: number): string {
  const legacy = ['bg-neutral-9', 'bg-accent-9', 'bg-warning-9', 'bg-success-9'];
  return legacy[index % legacy.length] ?? 'bg-neutral-9';
}

export function statusColorDotClass(color?: string | null): string {
  const key = color?.trim().toLowerCase() ?? 'neutral';
  return WORKFLOW_COLOR_DOT[key] ?? WORKFLOW_COLOR_DOT.neutral!;
}

export function priorityDotClass(priority?: string | null): string {
  const key = priority ?? 'medium';
  return PRIORITY_DOT[key] ?? PRIORITY_DOT.medium!;
}
