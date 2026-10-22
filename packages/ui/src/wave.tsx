import type { CSSProperties } from 'react';
import { cn } from '@hypha-platform/ui-utils';

import './wave.css';

/** Short bars stand in for text. Circles and pictures stay full shapes. */
export function isTextWave({
  className,
  text,
  height,
}: {
  className?: string;
  text?: boolean;
  height?: number | string;
}): boolean {
  if (text === true) return true;
  if (text === false) return false;
  if (className && /\brounded-full\b/.test(className)) return false;
  if (className && /\bh-(?:[1-6])\b/.test(className)) return true;
  if (className && /\bh-\[(?:[1-9]|1[0-8])px\]/.test(className)) return true;
  if (typeof height === 'number') return height > 0 && height <= 18;
  if (typeof height === 'string') {
    const value = Number.parseFloat(height);
    return height.trim().endsWith('px') && value > 0 && value <= 18;
  }
  return false;
}

/** One piece of a loading mask. Delays stagger so the sweep travels on. */
export function Wave({
  className,
  delayMs = 0,
  style,
  text,
}: {
  className?: string;
  delayMs?: number;
  style?: CSSProperties;
  /** Light only the top edge. Short text bars do this on their own. */
  text?: boolean;
}) {
  const textLine = isTextWave({ className, text, height: style?.height });
  return (
    <div
      className={cn('hypha-wave', textLine && 'hypha-wave-text', className)}
      style={{
        ...style,
        ['--hypha-wave-delay' as string]: `${delayMs}ms`,
      }}
      aria-hidden
    />
  );
}
