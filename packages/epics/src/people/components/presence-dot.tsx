'use client';

import { cn } from '@hypha-platform/ui-utils';

import type { PresenceLevel } from './member-presence';

const SIZE: Record<'sm' | 'md', number> = {
  sm: 8,
  md: 10,
};

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
        'absolute right-0 bottom-0 rounded-full ring-2 ring-background',
        level === 'active' && 'bg-success-9',
        level === 'idle' && 'bg-amber-9',
        level === 'offline' && 'border border-neutral-8 bg-background',
        className,
      )}
      style={{ width: px, height: px }}
    />
  );
}
