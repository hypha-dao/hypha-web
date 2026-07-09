import { cn } from '@hypha-platform/ui-utils';

/** Kanban columns — cap height so status headers stay visible while cards scroll. */
export const SIGNAL_KANBAN_COLUMN_SHELL_CLASS = cn(
  'max-h-[min(calc(100dvh-13rem),42rem)]',
);

/** Swimlane status row — room for lane header + in-column card scroll. */
export const SIGNAL_SWIMLANE_STATUS_ROW_CLASS = cn(
  'max-h-[min(calc(100dvh-15rem),36rem)] min-h-0',
);

/** Scrollable card stack inside a status column (kanban + swimlane). */
export const SIGNAL_STATUS_CARD_STACK_CLASS = cn(
  'flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-y-contain p-2.5',
  'touch-pan-y [scrollbar-gutter:stable] [scrollbar-width:thin]',
);
