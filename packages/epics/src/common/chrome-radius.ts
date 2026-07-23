/**
 * Subtle square corners for app chrome controls (header buttons, small avatars).
 * Uses theme token `--radius-chrome` (6px) from packages/ui-utils global.css.
 * Not pill, not soft card (xl/2xl).
 */
export const APP_CHROME_SUBTLE_SQUARE_RADIUS = 'rounded-chrome';

/** Square header / panel icon trigger — hairline chrome, not rounded-full. */
export const APP_CHROME_ICON_TRIGGER =
  'flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-chrome bg-muted p-0 text-muted-foreground ring-1 ring-border/70 transition-colors hover:text-foreground';
