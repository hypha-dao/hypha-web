import type { CSSProperties } from 'react';
import { cn } from '@hypha-platform/ui-utils';

import './member-home-wave.css';

/** One bar of the home loading mask. Delays stagger so the sweep travels down. */
export function HomeWave({
  className,
  delayMs = 0,
  style,
}: {
  className?: string;
  delayMs?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn('home-wave', className)}
      style={{
        ...style,
        ['--home-wave-delay' as string]: `${delayMs}ms`,
      }}
      aria-hidden
    />
  );
}
