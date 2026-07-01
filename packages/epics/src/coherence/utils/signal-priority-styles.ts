/** Workflow status colors — rings + tints for columns/headers (process stage). */
const WORKFLOW_STATUS_DOT: Record<string, string> = {
  neutral: 'bg-neutral-9 ring-2 ring-neutral-9/30',
  accent: 'bg-accent-9 ring-2 ring-accent-9/35',
  warn: 'bg-warning-9 ring-2 ring-warning-9/35',
  warning: 'bg-warning-9 ring-2 ring-warning-9/35',
  success: 'bg-success-9 ring-2 ring-success-9/35',
  error: 'bg-error-9 ring-2 ring-error-9/35',
};

const WORKFLOW_STATUS_TOP_BORDER: Record<string, string> = {
  neutral: 'border-t-neutral-9',
  accent: 'border-t-accent-9',
  warn: 'border-t-warning-9',
  warning: 'border-t-warning-9',
  success: 'border-t-success-9',
  error: 'border-t-error-9',
};

const WORKFLOW_STATUS_HEADER_TINT: Record<string, string> = {
  neutral: 'bg-neutral-3/35',
  accent: 'bg-accent-3/45',
  warn: 'bg-warning-3/45',
  warning: 'bg-warning-3/45',
  success: 'bg-success-3/40',
  error: 'bg-error-3/40',
};

/** Priority colors — left card stripe + list dots (urgency, not workflow stage). */
export const PRIORITY_LEFT_BORDER: Record<string, string> = {
  critical: 'bg-gradient-to-b from-error-10 via-error-9 to-error-10',
  high: 'bg-gradient-to-b from-warning-10 via-warning-9 to-warning-10',
  medium: 'bg-gradient-to-b from-accent-10 via-accent-9 to-accent-10',
  low: 'bg-neutral-7',
};

export const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-error-9 ring-2 ring-error-9/45 shadow-sm shadow-error-9/25',
  high: 'bg-warning-9 ring-2 ring-warning-9/45 shadow-sm shadow-warning-9/20',
  medium: 'bg-accent-9 ring-2 ring-accent-9/40',
  low: 'bg-neutral-8 ring-2 ring-neutral-8/35',
};

/** @deprecated Prefer statusColorDotClass — index-based dots clash with priority colors. */
export function statusColumnDotClass(index: number): string {
  const legacy = [
    'bg-neutral-9',
    'bg-accent-9',
    'bg-warning-9',
    'bg-success-9',
  ];
  return legacy[index % legacy.length] ?? 'bg-neutral-9';
}

export function statusColorDotClass(color?: string | null): string {
  const key = color?.trim().toLowerCase() ?? 'neutral';
  return WORKFLOW_STATUS_DOT[key] ?? WORKFLOW_STATUS_DOT.neutral!;
}

export function statusColumnTopBorderClass(color?: string | null): string {
  const key = color?.trim().toLowerCase() ?? 'neutral';
  return WORKFLOW_STATUS_TOP_BORDER[key] ?? WORKFLOW_STATUS_TOP_BORDER.neutral!;
}

export function statusHeaderTintClass(color?: string | null): string {
  const key = color?.trim().toLowerCase() ?? 'neutral';
  return (
    WORKFLOW_STATUS_HEADER_TINT[key] ?? WORKFLOW_STATUS_HEADER_TINT.neutral!
  );
}

export const PRIORITY_LEFT_BORDER_EDGE: Record<string, string> = {
  critical: 'border-l-error-9',
  high: 'border-l-warning-9',
  medium: 'border-l-accent-9',
  low: 'border-l-neutral-7',
};

export function priorityLeftBorderEdgeClass(priority?: string | null): string {
  const key = priority ?? 'medium';
  return PRIORITY_LEFT_BORDER_EDGE[key] ?? PRIORITY_LEFT_BORDER_EDGE.medium!;
}

export function priorityLeftBorderClass(priority?: string | null): string {
  const key = priority ?? 'medium';
  return PRIORITY_LEFT_BORDER[key] ?? PRIORITY_LEFT_BORDER.medium!;
}

export function priorityDotClass(priority?: string | null): string {
  const key = priority ?? 'medium';
  return PRIORITY_DOT[key] ?? PRIORITY_DOT.medium!;
}
