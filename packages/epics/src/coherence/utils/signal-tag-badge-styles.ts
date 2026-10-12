/**
 * Card meta type — assignee and deadline text on signal cards.
 * Tag/board badges reuse this so size, weight, line-height, and casing stay aligned.
 * Do not change assignee/deadline call sites to introduce this; they already match.
 */
export const SIGNAL_BOARD_META_TEXT_CLASS =
  'text-1 font-normal leading-[calc(16/12)] tracking-normal normal-case';

/** Quiet outline tags — hairline, no pill theater. */
export const SIGNAL_TAG_BADGE_CLASS = `${SIGNAL_BOARD_META_TEXT_CLASS} shrink-0 max-w-[8.5rem] overflow-hidden text-ellipsis whitespace-nowrap rounded-none border-border/60 bg-transparent text-muted-foreground shadow-none ring-0`;

/** Overflow counter (+N) when more tags exist than we show inline. */
export const SIGNAL_TAG_OVERFLOW_BADGE_CLASS = `${SIGNAL_BOARD_META_TEXT_CLASS} shrink-0 whitespace-nowrap rounded-none border-border/60 bg-transparent text-muted-foreground`;
