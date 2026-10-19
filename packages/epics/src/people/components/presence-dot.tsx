'use client';

import { cn } from '@hypha-platform/ui-utils';

import type { PresenceLevel } from './member-presence';

const SIZE: Record<'sm' | 'md', number> = {
  sm: 8,
  md: 10,
};

/**
 * Fixed fills. Dark mode maps success-9 onto a near-black green step, so a
 * light painted with that token disappeared on dark surfaces.
 */
export const presenceFillClass = {
  active: 'bg-[oklch(64.061%_0.13286_157.708)]',
  idle: 'bg-[oklch(76.8%_0.16_75)]',
  offline: 'border-[1.5px] border-[oklch(72%_0_0)] bg-transparent',
} as const;

/** Green = active, amber = idle, empty ring = offline. */
export function PresenceDot({
  level,
  size = 'md',
  className,
}: {
  level: PresenceLevel;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const px = SIZE[size];
  return (
    <span
      aria-hidden
      className={cn(
        'absolute right-0 bottom-0 z-10 rounded-full ring-2 ring-page-background',
        presenceFillClass[level],
        className,
      )}
      style={{ width: px, height: px }}
    />
  );
}
