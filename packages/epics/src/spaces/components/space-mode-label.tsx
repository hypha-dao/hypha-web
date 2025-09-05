'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { Badge } from '@hypha-platform/ui';
import clsx from 'clsx';
import Link from 'next/link';
import { useJoinSpace } from '../hooks/use-join-space';

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
}) => (
  <Link href={configPath} title="Change Space Configuration">
    <Badge className="flex" colorVariant="accent" variant="outline">
      {caption}
    </Badge>
  </Link>
);
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
  const { isMember } = useJoinSpace({ spaceId: web3SpaceId });
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
