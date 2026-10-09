'use client';

import { cn } from '@hypha-platform/ui-utils';

/**
 * Square ink mark: a few mycelium threads, not a crop of the hero photo.
 * currentColor keeps it ink on paper in light and paper on ink in dark.
 */
export function MemberHomeMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn('h-8 w-8 shrink-0 text-foreground', className)}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="square"
        strokeLinejoin="miter"
        d="M17.2 28c-.6-5.4-1.2-8.6-2.6-12.2-1.4-3.6-.2-6.8-2.2-10.2M14.6 15.6c3.8-.8 7.4-.6 11.4-3.6M14 19.2c3.4 2.2 6.8 2.4 11 1M13.4 14.2C10.4 12.2 7.6 11 4.6 7.8M12.6 22c-2.4 2.6-4.6 4.4-7.8 5.6"
      />
    </svg>
  );
}
