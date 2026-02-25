'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { Badge } from '@hypha-platform/ui';
import clsx from 'clsx';
import { useSpaceMember } from '../hooks';
import { useRouter } from 'next/navigation';

interface SpaceModeLabelProps {
  isSandbox: boolean;
  isDemo: boolean;
  isArchived: boolean;
  configPath?: string;
  web3SpaceId?: number;
  className?: string;
}

const LabelButton = ({
  caption,
  configPath,
  colorVariant = 'accent',
}: {
  caption: string;
  configPath: string;
  colorVariant?: 'accent' | 'error';
}) => {
  const router = useRouter();
  return (
    <Badge
      className="flex cursor-pointer"
      colorVariant={colorVariant}
      variant="outline"
      role="link"
      title="Change Space Configuration"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(configPath);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          router.push(configPath);
        }
      }}
      onMouseEnter={() => router.prefetch?.(configPath)}
    >
      {caption}
    </Badge>
  );
};
const LabelBadge = ({
  caption,
  colorVariant = 'accent',
}: {
  caption: string;
  colorVariant?: 'accent' | 'error';
}) => (
  <Badge className="flex" colorVariant={colorVariant} variant="outline">
    {caption}
  </Badge>
);

const MemberLabel = ({
  caption,
  web3SpaceId,
  configPath,
  colorVariant = 'accent',
}: {
  caption: string;
  web3SpaceId: number;
  configPath: string;
  colorVariant?: 'accent' | 'error';
}) => {
  const { isMember } = useSpaceMember({ spaceId: web3SpaceId });
  return isMember ? (
    <LabelButton
      caption={caption}
      configPath={configPath}
      colorVariant={colorVariant}
    />
  ) : (
    <LabelBadge caption={caption} colorVariant={colorVariant} />
  );
};

export const SpaceModeLabel = ({
  isSandbox,
  isDemo,
  isArchived,
  configPath,
  web3SpaceId,
  className,
}: SpaceModeLabelProps) => {
  const { isAuthenticated } = useAuthentication();
  const isLive = !isSandbox && !isDemo && !isArchived;
  if (isLive) {
    return null;
  }
  const caption = isSandbox
    ? 'Sandbox'
    : isDemo
    ? 'Pilot'
    : isArchived
    ? 'Archived'
    : '';
  const colorVariant = isArchived ? 'error' : 'accent';
  return (
    <div className={clsx('flex', className)}>
      {isAuthenticated && !!configPath && Number.isFinite(web3SpaceId) ? (
        <MemberLabel
          caption={caption}
          web3SpaceId={web3SpaceId as number}
          configPath={configPath}
          colorVariant={colorVariant}
        />
      ) : (
        <LabelBadge caption={caption} colorVariant={colorVariant} />
      )}
    </div>
  );
};
