import { cn } from '@hypha-platform/ui-utils';

/** Matches `SpaceHeaderInsetAvatar` — keep sticky identity row pixel-aligned */
export const SPACE_HEADER_IDENTITY_AVATAR_CLASS = cn(
  'h-16 w-16 shrink-0 rounded-full sm:h-[72px] sm:w-[72px]',
  'shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/15',
);

/** Same as hero space title (`Text` on banner) */
export const SPACE_HEADER_IDENTITY_TITLE_CLASS = cn(
  'text-balance text-6 font-semibold tracking-tight text-white drop-shadow-sm sm:text-7',
);

/** Same type scale as hero title; foreground for light chrome */
export const SPACE_HEADER_IDENTITY_TITLE_CLASS_CHROME = cn(
  'text-balance text-6 font-semibold tracking-tight text-foreground sm:text-7',
);
