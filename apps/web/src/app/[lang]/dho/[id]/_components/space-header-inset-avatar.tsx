'use client';

import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

type SpaceHeaderInsetAvatarProps = {
  src: string;
  /** Decorative — title provides accessible name */
  className?: string;
};

/**
 * Space logo inside the hero card (top-left, aligned with title column).
 * No edge bleed — keeps the rounded banner silhouette clean.
 */
export function SpaceHeaderInsetAvatar({
  src,
  className,
}: SpaceHeaderInsetAvatarProps) {
  return (
    <Avatar
      className={cn(
        'h-16 w-16 shrink-0 rounded-full sm:h-20 sm:w-20',
        'shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/15',
        className,
      )}
      aria-hidden
    >
      <AvatarImage src={src} alt="" className="object-cover" />
    </Avatar>
  );
}
