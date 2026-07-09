import { cn } from '@hypha-platform/ui-utils';

/** Kanban columns — fixed height so headers stay visible while cards scroll inside. */
export const SIGNAL_KANBAN_COLUMN_SHELL_CLASS = cn(
  'h-[min(calc(100dvh-13rem),42rem)] min-h-[8rem] overflow-hidden',
);

/** Swimlane status row — fixed height for horizontal status columns. */
export const SIGNAL_SWIMLANE_STATUS_ROW_CLASS = cn(
  'h-[min(calc(100dvh-15rem),36rem)] min-h-0 overflow-x-auto overflow-y-hidden',
);

/** Status column inside a swimlane row. */
export const SIGNAL_SWIMLANE_STATUS_COLUMN_CLASS = cn(
  'flex min-h-0 min-w-[15.5rem] flex-1 flex-col overflow-hidden',
);

/** Scrollable card stack inside a status column (kanban + swimlane). */
export const SIGNAL_STATUS_CARD_STACK_CLASS = cn(
  'flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-y-contain p-2.5',
  'touch-pan-y [scrollbar-gutter:stable] [scrollbar-width:thin] narrow-scrollbar',
  /* Keep full card height — scroll the column instead of squashing cards. */
  '[&>*]:shrink-0',
);
