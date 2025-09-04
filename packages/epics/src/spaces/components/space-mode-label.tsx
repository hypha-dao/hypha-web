'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useJoinSpace } from '@hypha-platform/epics';
import { Badge } from '@hypha-platform/ui';
import clsx from 'clsx';
import Link from 'next/link';

interface SpaceModeLabelProps {
  isSandbox: boolean;
  isDemo: boolean;
  configPath?: string;
  web3SpaceId?: number;
  className?: string;
}

const LabelButton = ({
  text,
  configPath,
}: {
  text: string;
  configPath: string;
}) => (
  <Link href={configPath} title="Change Space Configuration">
    <Badge className="flex" colorVariant="accent" variant="outline">
      {text}
    </Badge>
  </Link>
);
const LabelBadge = ({ text }: { text: string }) => (
  <Badge className="flex" colorVariant="accent" variant="outline">
    {text}
  </Badge>
);

export const SpaceModeLabel = ({
  isSandbox,
  isDemo,
  configPath,
  web3SpaceId,
  className,
}: SpaceModeLabelProps) => {
  const { isAuthenticated } = useAuthentication();
  const { isMember } = useJoinSpace({ spaceId: web3SpaceId as number });
  const isDisabled = !isAuthenticated || !isMember;
  return (
    <div className={clsx('flex', className)}>
      {isDisabled || !configPath ? (
        <>
          {isSandbox ? (
            <LabelBadge text="Sandbox" />
          ) : isDemo ? (
            <LabelBadge text="Pilot" />
          ) : null}
        </>
      ) : (
        <>
          {isSandbox ? (
            <LabelButton text="Sandbox" configPath={configPath} />
          ) : isDemo ? (
            <LabelButton text="Pilot" configPath={configPath} />
          ) : null}
        </>
      )}
    </div>
  );
};
