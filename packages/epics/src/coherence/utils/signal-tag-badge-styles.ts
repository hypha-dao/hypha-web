/**
 * Card meta type — assignee and deadline text on signal cards.
 * Tag/board badges reuse this so size, weight, line-height, and casing stay aligned.
 * Do not change assignee/deadline call sites to introduce this; they already match.
 */
export const SIGNAL_BOARD_META_TEXT_CLASS =
  'text-1 font-normal leading-[calc(16/12)] tracking-normal normal-case';

/**
 * Filter/select control text — Assignee and Deadline triggers (`text-2`).
 * Tag multi-select trigger, placeholder, chips, and options use this so they
 * match those selects (not Button uppercase / tracking / semibold).
 */
export const SIGNAL_BOARD_SELECT_TEXT_CLASS =
  'text-2 font-normal leading-[calc(20/14)] tracking-normal normal-case';

/** Quiet outline tags — hairline, no pill theater. */
export const SIGNAL_TAG_BADGE_CLASS = `${SIGNAL_BOARD_META_TEXT_CLASS} shrink-0 max-w-[8.5rem] overflow-hidden text-ellipsis whitespace-nowrap rounded-none border-border/60 bg-transparent text-muted-foreground shadow-none ring-0`;

/** Overflow counter (+N) when more tags exist than we show inline. */
export const SIGNAL_TAG_OVERFLOW_BADGE_CLASS = `${SIGNAL_BOARD_META_TEXT_CLASS} shrink-0 whitespace-nowrap rounded-none border-border/60 bg-transparent text-muted-foreground`;
