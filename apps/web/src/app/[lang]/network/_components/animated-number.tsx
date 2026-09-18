'use client';

import * as React from 'react';
import {
  formatCompact,
  formatUsd,
  prefersReducedMotion,
} from './format-network-stats';

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function AnimatedNumber({
  value,
  locale,
  format = 'compact',
  durationMs = 900,
}: {
  value: number;
  locale: string;
  format?: 'compact' | 'usd';
  durationMs?: number;
}) {
  const [display, setDisplay] = React.useState(0);
  const previous = React.useRef(0);

  React.useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (prefersReducedMotion() || from === value) {
      setDisplay(value);
      return;
    }

    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / durationMs, 1);
      const next = from + (value - from) * easeOutCubic(progress);
      setDisplay(next);
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [durationMs, value]);

  const formatted =
    format === 'usd'
      ? formatUsd(display, locale)
      : formatCompact(display, locale);

  return <>{formatted}</>;
}
