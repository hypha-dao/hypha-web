'use client';

import { cn } from '@hypha-platform/ui-utils';

/**
 * Square ink mark: mycelium threads meeting at a node, not a crop of the hero photo.
 * currentColor keeps it ink on paper in light and paper on ink in dark.
 */
export function MemberHomeMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn('h-8 w-8 shrink-0 text-foreground', className)}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="square"
        strokeLinejoin="miter"
      >
        <path d="M16 3.6 15.1 9.4 16 16l-1.15 7.2L16.5 28.6" />
        <path d="M15.1 9.4 10.2 5.2" />
        <path d="M16 16 22.2 11.6 28.6 7.4" />
        <path d="M22.2 11.6 26.6 15.4" />
        <path d="M16 16 22.6 20.4 29 22" />
        <path d="M16 16 10.4 11.8 4.2 6.6" />
        <path d="M10.4 11.8 6.6 15.2" />
        <path d="M16 16 10.8 21.8 4.6 27.4" />
      </g>
      <rect x="14.55" y="14.55" width="2.9" height="2.9" fill="currentColor" />
      <rect x="15.15" y="2.2" width="1.55" height="1.55" fill="currentColor" />
      <rect x="27.7" y="6.15" width="1.55" height="1.55" fill="currentColor" />
      <rect x="3.15" y="5.4" width="1.55" height="1.55" fill="currentColor" />
      <rect x="3.55" y="26.55" width="1.55" height="1.55" fill="currentColor" />
      <rect
        x="28.15"
        y="21.05"
        width="1.55"
        height="1.55"
        fill="currentColor"
      />
    </svg>
  );
}
