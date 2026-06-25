import { cn } from '@hypha-platform/ui-utils';

/** Matches top-nav `ButtonNavItem` active styling (ghost neutral + bg-neutral-3). */
export const segmentedListClass =
  'inline-flex h-10 w-fit max-w-full shrink-0 items-center gap-1 p-0';

export const segmentedTriggerClass =
  'flex flex-initial justify-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-neutral-11 shadow-none transition-colors hover:bg-neutral-3 hover:text-foreground data-[state=active]:bg-neutral-3 data-[state=active]:text-foreground sm:gap-1.5 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-sm';

export function segmentedButtonClass(active: boolean) {
  return cn(
    'inline-flex min-w-0 flex-initial items-center justify-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:gap-1.5 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-sm',
    'text-neutral-11 hover:bg-neutral-3 hover:text-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
    active && 'bg-neutral-3 text-foreground',
  );
}
