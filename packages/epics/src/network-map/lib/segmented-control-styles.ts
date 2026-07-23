import { cn } from '@hypha-platform/ui-utils';

/**
 * Craft segmented controls for the Network map toolbar.
 * Switch track + raised active pill (TabsTrigger `switch` / outline selected).
 */

/** Track behind exclusive projection / view switches. */
export const segmentedListClass =
  'inline-flex h-9 w-fit max-w-full shrink-0 items-center gap-0.5 rounded-lg bg-neutral-3 p-0.5 sm:h-10';

/** Exclusive TabsTrigger inside a switch track. */
export const segmentedTriggerClass = cn(
  'flex flex-initial justify-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-none',
  'text-neutral-11 transition-colors hover:text-foreground',
  'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
  'data-[state=inactive]:bg-transparent',
  'sm:gap-1.5 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-sm',
);

/**
 * Independent layer toggles (Land / Water / Grid).
 * Active = filled + bordered pill so selection reads in light and dark.
 */
export function segmentedButtonClass(active: boolean) {
  return cn(
    'inline-flex min-w-0 flex-initial items-center justify-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium sm:gap-1.5 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-sm',
    'border transition-[background-color,border-color,color,box-shadow] duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
    active
      ? 'border-border bg-background text-foreground shadow-sm'
      : 'border-transparent bg-transparent text-neutral-11 hover:bg-neutral-3 hover:text-foreground',
  );
}
