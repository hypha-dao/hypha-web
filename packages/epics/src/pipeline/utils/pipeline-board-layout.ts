import { cn } from '@hypha-platform/ui-utils';

/**
 * Swimlane status row — grows with its cards up to a viewport-relative cap, so
 * a quiet lane stays short while a busy one fills the screen before scrolling.
 * Matches the signal swimlane row.
 */
export const PIPELINE_SWIMLANE_STATUS_ROW_CLASS = cn(
  'max-h-[min(calc(100dvh-13rem),46rem)] min-h-[9rem] overflow-x-auto overflow-y-hidden',
);

/** Status column inside a pipeline swimlane row. */
export const PIPELINE_SWIMLANE_STATUS_COLUMN_CLASS = cn(
  'flex min-h-0 min-w-[15.5rem] flex-1 flex-col overflow-hidden',
);

/**
 * Single-board columns — fixed height so headers stay visible while cards
 * scroll inside. Matches the signal kanban column shell.
 */
export const PIPELINE_BOARD_COLUMN_SHELL_CLASS = cn(
  'h-[min(calc(100dvh-13rem),56rem)] min-h-[8rem] overflow-hidden',
);

/** Scrollable card stack inside a pipeline status column. */
export const PIPELINE_CARD_STACK_CLASS = cn(
  'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-auto p-2',
  'touch-pan-y [scrollbar-gutter:stable] [scrollbar-width:thin] narrow-scrollbar',
  '[&>*]:shrink-0',
);
