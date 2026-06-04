import { cn } from '@hypha-platform/ui-utils';

/** Space-accent in-call alerts — readable on light and dark dock chrome. */
export const callAccentAlertBorder =
  'border-[color:color-mix(in_srgb,var(--color-accent-9,var(--space-accent,#4a65d8))_30%,transparent)]';

export const callAccentAlertSurface =
  'bg-[color:color-mix(in_srgb,var(--color-accent-9,var(--space-accent,#4a65d8))_12%,var(--background))]';

export const callAccentAlertText =
  'text-[color:var(--color-accent-12,var(--foreground))]';

export const callAccentAlertSecondaryText =
  'text-[color:color-mix(in_srgb,var(--color-accent-11,var(--foreground))_88%,transparent)]';

export const callAccentAlertDismissClassName =
  'shrink-0 text-xs font-medium text-[color:var(--color-accent-12,var(--foreground))] underline-offset-2 hover:underline';

export const callAccentAlertActionButtonClassName =
  'inline-flex h-7 items-center rounded-md border border-[color:color-mix(in_srgb,var(--color-accent-9,var(--space-accent,#4a65d8))_45%,var(--border))] bg-background/90 px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent-3 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring';

export const callAccentAlertIconButtonClassName =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[color:var(--color-accent-12,var(--foreground))] transition-colors hover:bg-[color:color-mix(in_srgb,var(--color-accent-9,var(--space-accent,#4a65d8))_16%,var(--background))] focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring';

export function callAccentAlertRowClassName(extra?: string) {
  return cn(
    'flex items-start gap-2 border-b px-4 py-1.5',
    callAccentAlertBorder,
    callAccentAlertSurface,
    extra,
  );
}

export function callAccentAlertCompactRowClassName(extra?: string) {
  return cn(
    'flex min-h-9 items-center gap-2 border-b px-3 py-1.5 sm:min-h-10 sm:px-3.5',
    callAccentAlertBorder,
    callAccentAlertSurface,
    extra,
  );
}

/** Status copy on dark video tiles (participant waiting / stalled). */
export const callAccentAlertOnDarkText =
  'text-[color:color-mix(in_srgb,var(--space-accent,var(--color-accent-9,#4a65d8))_72%,white)]';

/** Circular in-banner / dock toolbar triggers (reactions, etc.). */
export const callAccentToolbarTriggerIdle =
  'border border-accent-9/40 bg-background text-accent-9 shadow-sm hover:bg-accent-3/80 hover:text-accent-11';

export const callAccentToolbarTriggerActive =
  'border-accent-9/50 bg-accent-9/15 text-foreground ring-1 ring-inset ring-accent-9/25 dark:border-accent-10/45 dark:bg-accent-9/20 dark:text-foreground';

export const callAccentToolbarMenuRowActive =
  'ring-1 ring-inset ring-accent-9/30 bg-accent-9/12';
