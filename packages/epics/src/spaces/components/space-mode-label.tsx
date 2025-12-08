'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { Badge } from '@hypha-platform/ui';
import clsx from 'clsx';
import Link from 'next/link';
import { useSpaceMember } from '../hooks';
import { useRouter } from 'next/navigation';

interface SpaceModeLabelProps {
  isSandbox: boolean;
  isDemo: boolean;
  configPath?: string;
  web3SpaceId?: number;
  className?: string;
}

const LabelButton = ({
  caption,
  configPath,
}: {
  caption: string;
  configPath: string;
}) => {
  const router = useRouter();
  return (
    <Badge
      className="flex cursor-pointer"
      colorVariant="accent"
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
const LabelBadge = ({ caption }: { caption: string }) => (
  <Badge className="flex" colorVariant="accent" variant="outline">
    {caption}
  </Badge>
);

const MemberLabel = ({
  caption,
  web3SpaceId,
  configPath,
}: {
  caption: string;
  web3SpaceId: number;
  configPath: string;
}) => {
  const { isMember } = useSpaceMember({ spaceId: web3SpaceId });
  return isMember ? (
    <LabelButton caption={caption} configPath={configPath} />
  ) : (
    <LabelBadge caption={caption} />
  );
};

export const SpaceModeLabel = ({
  isSandbox,
  isDemo,
  configPath,
  web3SpaceId,
  className,
}: SpaceModeLabelProps) => {
  const { isAuthenticated } = useAuthentication();
  const isLive = !isSandbox && !isDemo;
  if (isLive) {
    return null;
  }
  const caption = isSandbox ? 'Sandbox' : isDemo ? 'Pilot' : '';
  return (
    <div className={clsx('flex', className)}>
      {isAuthenticated && !!configPath && Number.isFinite(web3SpaceId) ? (
        <MemberLabel
          caption={caption}
          web3SpaceId={web3SpaceId as number}
          configPath={configPath}
        />
      ) : (
        <LabelBadge caption={caption} />
      )}
    </div>
  );
};
