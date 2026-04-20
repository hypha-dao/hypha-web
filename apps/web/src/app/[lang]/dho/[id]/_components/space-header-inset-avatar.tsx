'use client';

import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

type SpaceHeaderInsetAvatarProps = {
  src: string;
};

/** Logo inside the hero, left of title + links (no edge bleed) */
export function SpaceHeaderInsetAvatar({ src }: SpaceHeaderInsetAvatarProps) {
  return (
    <Avatar
      className={cn(
        'h-16 w-16 shrink-0 rounded-full sm:h-[72px] sm:w-[72px]',
        'shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/15',
      )}
      aria-hidden
    >
      <AvatarImage src={src} alt="" className="object-cover" />
    </Avatar>
  );
}
