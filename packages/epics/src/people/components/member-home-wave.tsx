import type { CSSProperties } from 'react';
import { Wave } from '@hypha-platform/ui';

/** One bar of the home loading mask. Delays stagger so the sweep travels down. */
export function HomeWave({
  className,
  delayMs = 0,
  style,
  text,
}: {
  className?: string;
  delayMs?: number;
  style?: CSSProperties;
  /** Light only the top edge of a text line. */
  text?: boolean;
}) {
  return (
    <Wave className={className} delayMs={delayMs} style={style} text={text} />
  );
}
