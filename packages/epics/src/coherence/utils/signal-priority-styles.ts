/** Workflow status colors — rings + top borders for columns (process stage). */
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

/** Priority colors — left card stripe + list dots (urgency, not workflow stage). */
export const PRIORITY_LEFT_BORDER: Record<string, string> = {
  critical: 'bg-error-9',
  high: 'bg-warning-9',
  medium: 'bg-accent-9',
  low: 'bg-neutral-7',
};

export const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-error-9',
  high: 'bg-warning-9',
  medium: 'bg-accent-9',
  low: 'bg-neutral-8',
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
