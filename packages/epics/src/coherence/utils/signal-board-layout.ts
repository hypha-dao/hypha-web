import { cn } from '@hypha-platform/ui-utils';

/** Upvote/grid — cards in the same row share height. */
export const SIGNAL_GRID_LAYOUT_CLASS = cn(
  'grid w-full grid-cols-1 items-stretch gap-2 md:grid-cols-[repeat(auto-fill,minmax(min(100%,14.25rem),1fr))]',
);

export const SIGNAL_GRID_CARD_WRAPPER_CLASS = cn(
  'flex h-full min-h-0 w-full flex-col',
);

/** Kanban task cards — quiet density; grow when footer content wraps. */
export const SIGNAL_KANBAN_TASK_CARD_SHELL_CLASS = cn(
  'flex min-h-[11.5rem] flex-col',
);

/** Swimlane task cards — quiet density; grow when footer content wraps. */
export const SIGNAL_SWIMLANE_TASK_CARD_SHELL_CLASS = cn(
  'flex min-h-[10.75rem] flex-col',
);

/** List rows — uniform minimum height within the list view. */
export const SIGNAL_LIST_ITEM_SHELL_CLASS = cn('min-h-[6rem]');

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
  'flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-y-auto p-2.5',
  'touch-pan-y [scrollbar-gutter:stable] [scrollbar-width:thin] narrow-scrollbar',
  /* Keep full card height — scroll the column instead of squashing cards. */
  '[&>*]:shrink-0',
);
