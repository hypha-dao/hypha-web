import { cn } from '@hypha-platform/ui-utils';

/** Upvote/grid — each card is only as tall as its own content. */
export const SIGNAL_GRID_LAYOUT_CLASS = cn(
  'grid w-full grid-cols-1 items-start gap-2 md:grid-cols-[repeat(auto-fill,minmax(min(100%,14.25rem),1fr))]',
);

export const SIGNAL_GRID_CARD_WRAPPER_CLASS = cn(
  'flex h-auto min-h-0 w-full flex-col',
);

/** Kanban task cards — quiet density; grow when the title or footer wraps. */
export const SIGNAL_KANBAN_TASK_CARD_SHELL_CLASS = cn(
  'flex min-h-[6.25rem] flex-col',
);

/** Swimlane task cards — quiet density; grow when the title or footer wraps. */
export const SIGNAL_SWIMLANE_TASK_CARD_SHELL_CLASS = cn(
  'flex min-h-[6rem] flex-col',
);

/** List rows — height follows the row, with the row's own padding as the gap. */
export const SIGNAL_LIST_ITEM_SHELL_CLASS = cn('min-h-0');

/**
 * Kanban columns — as tall as their cards, and only as tall as the viewport
 * when a column has more cards than fit. A fixed height left an empty band
 * under short columns.
 */
export const SIGNAL_KANBAN_COLUMN_SHELL_CLASS = cn(
  'h-auto max-h-[min(calc(100dvh-13rem),56rem)] min-h-0 overflow-hidden',
);

/**
 * Swimlane status row — grows with its cards up to a viewport-relative cap, so
 * a quiet lane stays short while a busy one scrolls.
 */
export const SIGNAL_SWIMLANE_STATUS_ROW_CLASS = cn(
  'h-auto max-h-[min(calc(100dvh-13rem),46rem)] min-h-0 overflow-x-auto overflow-y-hidden',
);

/** Status column inside a swimlane row. */
export const SIGNAL_SWIMLANE_STATUS_COLUMN_CLASS = cn(
  'flex min-h-0 min-w-[15.5rem] flex-1 flex-col overflow-hidden',
);

/** Scrollable card stack inside a status column (kanban + swimlane). */
export const SIGNAL_STATUS_CARD_STACK_CLASS = cn(
  'flex min-h-0 grow flex-col gap-2 overflow-y-auto overscroll-y-auto p-2',
  'touch-pan-y [scrollbar-gutter:stable] [scrollbar-width:thin] narrow-scrollbar',
  /* Keep full card height — scroll the column instead of squashing cards. */
  '[&>*]:shrink-0',
);
