import type { CSSProperties } from 'react';

export const SIGNAL_TAG_BADGE_CLASS =
  'max-w-[8.5rem] overflow-hidden text-ellipsis whitespace-nowrap rounded-full';

export const signalTagBadgeStyle: CSSProperties = {
  borderColor:
    'color-mix(in srgb, var(--space-accent) 42%, var(--color-neutral-8) 58%)',
  backgroundColor:
    'color-mix(in srgb, var(--space-accent) 12%, transparent)',
  color: 'color-mix(in srgb, var(--space-accent) 55%, var(--foreground) 45%)',
};
