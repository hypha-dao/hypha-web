'use client';

import { Avatar, AvatarImage } from '@hypha-platform/ui';

import { SPACE_HEADER_IDENTITY_AVATAR_CLASS } from './space-header-identity-tokens';

type SpaceHeaderInsetAvatarProps = {
  src: string;
};

/** Logo inside the hero, left of title + links (no edge bleed) */
export function SpaceHeaderInsetAvatar({ src }: SpaceHeaderInsetAvatarProps) {
  return (
    <Avatar className={SPACE_HEADER_IDENTITY_AVATAR_CLASS} aria-hidden>
      <AvatarImage src={src} alt="" className="object-cover" />
    </Avatar>
  );
}
