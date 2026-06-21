import { Avatar, AvatarImage, AvatarFallback } from '@hypha-platform/ui';
import { UserIcon } from 'lucide-react';
import { Skeleton } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

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
  /** MenuTop / ghost `Button` row: matches default `min-h-10` (40px) */
  toolbar: { avatar: 'h-10 w-10 shrink-0', skeleton: '40px' },
};

export const PersonAvatar = ({
  avatarSrc,
  userName,
  className = '',
  isLoading = false,
  size = 'md',
  shape = 'rounded',
}: {
  avatarSrc?: string;
  userName?: string;
  className?: string;
  isLoading?: boolean;
  size?: AvatarSize;
  /** `circle` = full round; `squircle` ≈ superellipse; `rounded` = square + subtle corners */
  shape?: 'rounded' | 'squircle' | 'circle';
}) => {
  const getFallbackContent = () => {
    if (!userName) {
      return <UserIcon className="w-4 h-4" />;
    }

    const nameParts = userName.split(' ');
    if (nameParts.length === 1) {
      return nameParts[0]?.charAt(0);
    } else if (nameParts.length >= 2) {
      return `${nameParts[0]?.charAt(0)}${nameParts[1]?.charAt(0)}`;
    }
  };

  const { avatar: avatarSize, skeleton: skeletonSize } = sizeMap[size];
  const radiusClass =
    shape === 'circle'
      ? 'rounded-full'
      : shape === 'squircle'
      ? 'rounded-[35%]'
      : 'rounded-md';

  return (
    <Skeleton
      width={skeletonSize}
      height={skeletonSize}
      loading={isLoading}
      className={cn(radiusClass, className)}
    >
      <Avatar className={cn(avatarSize, radiusClass, className)}>
        <AvatarImage src={avatarSrc} alt={`${userName}'s avatar`} />
        <AvatarFallback>{getFallbackContent()}</AvatarFallback>
      </Avatar>
    </Skeleton>
  );
};
