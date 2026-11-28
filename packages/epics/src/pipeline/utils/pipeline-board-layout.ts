import { cn } from '@hypha-platform/ui-utils';

/**
 * Swimlane status row. On a phone the statuses stack and the page scrolls.
 * From md up the row grows with its cards up to a viewport cap, matching the
 * signal swimlane.
 */
export const PIPELINE_SWIMLANE_STATUS_ROW_CLASS = cn(
  'flex w-full min-h-0 flex-col overflow-visible',
  'md:max-h-[min(calc(100dvh-13rem),46rem)] md:min-h-[9rem] md:flex-row md:overflow-x-auto md:overflow-y-hidden',
);

/** Status column inside a pipeline swimlane row. */
export const PIPELINE_SWIMLANE_STATUS_COLUMN_CLASS = cn(
  'flex w-full min-w-0 flex-none flex-col overflow-visible border-b border-border/50 last:border-b-0',
  'md:min-h-0 md:min-w-[15.5rem] md:flex-1 md:overflow-hidden md:border-b-0 md:border-r md:last:border-r-0',
);

/**
 * Single-board columns. On a phone each status is the full width and as tall
 * as its cards. From md up the column keeps a fixed height so the header stays
 * put while cards scroll inside.
 */
export const PIPELINE_BOARD_COLUMN_SHELL_CLASS = cn(
  'h-auto w-full min-w-0 flex-none overflow-visible border-b border-border/50 last:border-b-0',
  'md:h-[min(calc(100dvh-13rem),56rem)] md:min-h-[8rem] md:min-w-[17.5rem] md:flex-1 md:overflow-hidden md:border-b-0 md:border-r md:last:border-r-0',
);

/**
 * Card stack inside a status column. The page scrolls it on a phone. From md
 * up the column scrolls on its own.
 */
export const PIPELINE_CARD_STACK_CLASS = cn(
  'flex min-h-0 flex-col gap-2 p-2',
  'md:flex-1 md:overflow-y-auto md:overscroll-y-auto md:touch-pan-y md:[scrollbar-gutter:stable] md:[scrollbar-width:thin] md:narrow-scrollbar',
  '[&>*]:shrink-0',
);
