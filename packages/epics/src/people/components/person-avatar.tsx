'use client';

import { Avatar, AvatarImage, AvatarFallback } from '@hypha-platform/ui';
import { UserIcon } from 'lucide-react';
import { Skeleton } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import type { PresenceLevel } from './member-presence';
import { useRegisteredPresence } from './member-presence-provider';
import { PresenceDot } from './presence-dot';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'chat' | 'reply' | 'toolbar';

const sizeMap: Record<AvatarSize, { avatar: string; skeleton: string }> = {
  xs: { avatar: 'w-[12px] h-[12px]', skeleton: '12px' },
  sm: { avatar: 'w-[24px] h-[24px]', skeleton: '24px' },
  md: { avatar: 'w-[32px] h-[32px]', skeleton: '32px' },
  lg: { avatar: 'w-[64px] h-[64px]', skeleton: '64px' },
  /** Human chat timeline (~Discord proportions): main message */
  chat: { avatar: 'h-10 w-10', skeleton: '40px' },
  /** Rich-reply quoted author */
  reply: { avatar: 'h-4 w-4', skeleton: '16px' },
  /** MenuTop chrome: 36px square (important beats Avatar’s default h-10/w-10) */
  toolbar: {
    avatar: '!h-[36px] !w-[36px] shrink-0',
    skeleton: '36px',
  },
};

function presenceDotSize(size: AvatarSize): 'sm' | 'md' {
  return size === 'xs' ||
    size === 'sm' ||
    size === 'reply' ||
    size === 'md' ||
    size === 'toolbar'
    ? 'sm'
    : 'md';
}

export const PersonAvatar = ({
  avatarSrc,
  userName,
  className = '',
  isLoading = false,
  size = 'md',
  shape = 'circle',
  personId,
  matrixUserId,
  presence: presenceProp,
  showPresence,
}: {
  avatarSrc?: string;
  userName?: string;
  className?: string;
  isLoading?: boolean;
  size?: AvatarSize;
  /** `circle` = full round (default; survives `--radius-md: 0`); `squircle` ≈ superellipse; `rounded` = soft corners; `square` = website chrome */
  shape?: 'rounded' | 'squircle' | 'circle' | 'square';
  /** When set on a circle portrait, registers for live Matrix presence lights. */
  personId?: number;
  /** Fallback when no personId (e.g. Matrix-only room members). */
  matrixUserId?: string;
  /** Explicit level — skips registry when set. */
  presence?: PresenceLevel;
  /** Override auto light visibility (default: circle + known person/matrix id or presence). */
  showPresence?: boolean;
}) => {
  const registeredPresence = useRegisteredPresence({
    personId: presenceProp == null ? personId : undefined,
    matrixUserId: presenceProp == null ? matrixUserId : undefined,
  });
  const presence = presenceProp ?? registeredPresence;
  const shouldShowPresence =
    showPresence ??
    (shape === 'circle' &&
      presence != null &&
      (personId != null ||
        Boolean(matrixUserId?.trim()) ||
        presenceProp != null));

  const getFallbackContent = () => (
    // Quiet icon fallback — letter initials read as broken/missing photos in chat.
    <UserIcon className="h-[45%] w-[45%]" aria-hidden />
  );

  const { avatar: avatarSize, skeleton: skeletonSize } = sizeMap[size];
  const radiusClass =
    shape === 'circle'
      ? 'rounded-full'
      : shape === 'squircle'
      ? 'rounded-[35%]'
      : shape === 'square'
      ? 'rounded-none'
      : 'rounded-md';

  const portrait = (
    <Skeleton
      width={skeletonSize}
      height={skeletonSize}
      loading={isLoading}
      className={cn(radiusClass, className, 'border-0 shadow-none ring-0')}
    >
      <Avatar
        className={cn(
          avatarSize,
          radiusClass,
          className,
          /* Profile photos never carry a frame — overrides caller ring/border. */
          'border-0 shadow-none ring-0',
        )}
      >
        <AvatarImage src={avatarSrc} alt={`${userName}'s avatar`} />
        <AvatarFallback>{getFallbackContent()}</AvatarFallback>
      </Avatar>
    </Skeleton>
  );

  if (!shouldShowPresence || presence == null) {
    return portrait;
  }

  return (
    <span className="relative inline-flex shrink-0">
      {portrait}
      <PresenceDot level={presence} size={presenceDotSize(size)} />
    </span>
  );
};
