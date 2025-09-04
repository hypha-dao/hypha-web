'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useJoinSpace } from '@hypha-platform/epics';
import { Badge, Button } from '@hypha-platform/ui';
import clsx from 'clsx';
import Link from 'next/link';

interface SpaceStateLabelProps {
  isSandbox: boolean;
  isDemo: boolean;
  configPath: string;
  web3SpaceId?: number;
  className?: string;
}

const LabelButton = ({
  text,
  configPath,
}: {
  text: string;
  configPath: string;
}) => {
  return (
    <Link href={configPath} title="Change Space Configuration">
      <Button colorVariant="accent" variant="outline">
        <span className="hidden sm:flex">{text}</span>
      </Button>
    </Link>
  );
};
const LabelBadge = ({ text }: { text: string }) => {
  return (
    <Badge className="flex" colorVariant="accent" variant="outline">
      {text}
    </Badge>
  );
};

export const SpaceStateLabel = ({
  isSandbox,
  isDemo,
  configPath,
  web3SpaceId,
  className,
}: SpaceStateLabelProps) => {
  const { isAuthenticated } = useAuthentication();
  const { isMember } = useJoinSpace({ spaceId: web3SpaceId as number });
  const isDisabled = !isAuthenticated || !isMember;
  return (
    <div className={clsx('flex', className)}>
      {isDisabled ? (
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
