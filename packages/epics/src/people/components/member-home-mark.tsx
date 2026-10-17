'use client';

import type { SVGProps } from 'react';
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
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      >
        <path d="M15.2 14.8 12.4 9.2" />
        <path d="M12.4 9.2 7.2 5" />
        <path d="M12.4 9.2 16.8 4.2" />
        <path d="M17.1 16.2 23.2 14.6" />
        <path d="M23.2 14.6 28.2 10.4" />
        <path d="M23.2 14.6 29 18.2" />
        <path d="M15.6 17.2 12.2 22.6" />
        <path d="M12.2 22.6 7 27.6" />
        <path d="M12.2 22.6 16.4 28.4" />
      </g>
      <rect x="14.7" y="14.7" width="2.6" height="2.6" fill="currentColor" />
      <rect x="6.3" y="4.1" width="1.5" height="1.5" fill="currentColor" />
      <rect x="16" y="3.3" width="1.5" height="1.5" fill="currentColor" />
      <rect x="27.4" y="9.5" width="1.5" height="1.5" fill="currentColor" />
      <rect x="28.2" y="17.4" width="1.5" height="1.5" fill="currentColor" />
      <rect x="6.1" y="26.8" width="1.5" height="1.5" fill="currentColor" />
      <rect x="15.6" y="27.6" width="1.5" height="1.5" fill="currentColor" />
    </svg>
  );
}

type MyceliumMenuIconProps = SVGProps<SVGSVGElement> & {
  strokeWidth?: number | string;
};

/**
 * Same mycelium as {@link MemberHomeMark}, drawn as a thin stroke icon
 * so it sits with the other nav glyphs (round caps, currentColor, strokeWidth).
 */
export function MyceliumMenuIcon({
  className,
  strokeWidth = 1.25,
  ...props
}: MyceliumMenuIconProps) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M11.4 11.2 9.5 7.3" />
      <path d="M9.5 7.3 6 4.4" />
      <path d="M9.5 7.3 12.6 3.9" />
      <path d="M12.8 12.1 17 11" />
      <path d="M17 11 20.4 8.2" />
      <path d="M17 11 20.9 13.5" />
      <path d="M11.7 12.8 9.4 16.5" />
      <path d="M9.4 16.5 5.8 20" />
      <path d="M9.4 16.5 12.3 20.5" />
      <g fill="currentColor" stroke="none">
        <circle cx="12" cy="12" r="1.15" />
        <circle cx="6" cy="4.4" r="0.85" />
        <circle cx="12.6" cy="3.9" r="0.85" />
        <circle cx="20.4" cy="8.2" r="0.85" />
        <circle cx="20.9" cy="13.5" r="0.85" />
        <circle cx="5.8" cy="20" r="0.85" />
        <circle cx="12.3" cy="20.5" r="0.85" />
      </g>
    </svg>
  );
}
