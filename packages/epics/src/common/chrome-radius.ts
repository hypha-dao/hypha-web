/**
 * Square chrome controls — match io.hypha.earth (no radius, no fill slab).
 * Uses theme token `--radius-chrome` (0).
 */
export const APP_CHROME_SUBTLE_SQUARE_RADIUS = 'rounded-chrome';

/**
 * Square header / panel icon trigger — hairline only, quiet ink.
 * Use px sizes: theme `--spacing-8/9` are 48/64px and overflow the 76px MenuTop.
 */
export const APP_CHROME_ICON_TRIGGER =
  'flex h-[36px] w-[36px] shrink-0 items-center justify-center overflow-hidden rounded-none bg-transparent p-0 text-muted-foreground ring-1 ring-border/70 transition-colors hover:bg-foreground/5 hover:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:stroke-[1.25]';

/**
 * MenuTop profile avatar button — same 36px square rhythm as icon / language chrome.
 * No ring/border/shadow: the photo is the control (a frame reads as a black outline
 * once accent/border resolve to ink).
 */
export const APP_CHROME_AVATAR_TRIGGER =
  'box-border flex h-[36px] min-h-[36px] w-[36px] min-w-[36px] shrink-0 items-center justify-center isolate overflow-hidden rounded-none border-0 bg-transparent p-0 text-foreground shadow-none outline-none ring-0 transition-colors duration-150 hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-0 data-[state=open]:bg-foreground/5';
