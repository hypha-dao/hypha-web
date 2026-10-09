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
        d="M16 27.5V16.2M16 16.2C16 11.6 10.2 11 6.5 6M16 16.2C16.4 12.2 22 10.6 26.2 5.8M16 16.2C12.4 17.4 9.6 20.6 6 21.4M16 18.4C19.2 19.2 22 22.4 26.4 24.6M12.2 22.6C10.6 24.6 9 26.2 6.4 27.2M19.8 20.6C21.8 22.2 24.2 22.8 26.8 21.2"
      />
    </svg>
  );
}
