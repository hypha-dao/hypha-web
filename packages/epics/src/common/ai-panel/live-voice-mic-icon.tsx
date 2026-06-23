'use client';

import { Mic, Sparkles } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

type LiveVoiceMicIconProps = {
  className?: string;
  /** Mic line size (Sparkles scales relative to this). */
  size?: 'sm' | 'md';
};

/**
 * Mic + sparkle — signals live two-way voice, not dictation/transcription.
 */
export function LiveVoiceMicIcon({
  className,
  size = 'sm',
}: LiveVoiceMicIconProps) {
  const micClass = size === 'md' ? 'size-5' : 'size-3.5';
  const sparkClass = size === 'md' ? 'size-2.5' : 'size-2';

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center', className)}
      aria-hidden
    >
      <Mic className={micClass} />
      <Sparkles
        className={cn(
          'absolute -right-0.5 -top-0.5 text-accent-11',
          sparkClass,
        )}
      />
    </span>
  );
}
