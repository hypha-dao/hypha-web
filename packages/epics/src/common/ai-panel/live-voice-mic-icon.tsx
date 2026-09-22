'use client';

import { cn } from '@hypha-platform/ui-utils';

type LiveVoiceMicIconProps = {
  className?: string;
  /** Mic line size. */
  size?: 'sm' | 'md';
};

const MIC_PATHS = (
  <>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </>
);

/**
 * Thin monochrome mic for live two-way voice.
 * Same stroke as the rest of the website chrome — no sparkle, no fill.
 */
export function LiveVoiceMicIcon({
  className,
  size = 'sm',
}: LiveVoiceMicIconProps) {
  const dimensionClass = size === 'md' ? 'size-5' : 'size-3.5';

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 text-current', dimensionClass, className)}
      aria-hidden
    >
      <g
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {MIC_PATHS}
      </g>
    </svg>
  );
}
