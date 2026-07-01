/** Layout-only classes for signal tag pills — color comes from Badge `soft` + `accent`. */
export const SIGNAL_TAG_BADGE_CLASS =
  'shrink-0 whitespace-nowrap rounded-full';

/** Overflow counter (+N) when more tags exist than we show inline. */
export const SIGNAL_TAG_OVERFLOW_BADGE_CLASS =
  `${SIGNAL_TAG_BADGE_CLASS} border-border/60 bg-transparent text-muted-foreground`;
