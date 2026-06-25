'use client';

import { cn } from '@hypha-platform/ui-utils';

type LiveVoiceMicIconProps = {
  className?: string;
  /** Mic line size (sparkle scales relative to this). */
  size?: 'sm' | 'md';
};

const MIC_PATHS = (
  <>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </>
);

/** Small sparkle badge — top-right of mic head (matches onboarding voice orb sketch). */
const SPARKLE_BADGE = (
  <>
    <path d="M16.2 2.2 16.8 3.8l1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" />
    <circle cx="14.8" cy="5.4" r="0.55" />
  </>
);

/**
 * Mic + sparkle badge — signals live two-way voice, not dictation/transcription.
 * Sparkle sits on the mic capsule (not beside it).
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
      className={cn('shrink-0', dimensionClass, className)}
      aria-hidden
    >
      <g
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {MIC_PATHS}
      </g>
      <g className="text-accent-11" fill="currentColor" stroke="none">
        {SPARKLE_BADGE}
      </g>
    </svg>
  );
}
