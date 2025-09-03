'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useJoinSpace } from '@hypha-platform/epics';
import { Button } from '@hypha-platform/ui';
import Link from 'next/link';

interface SpaceStateLabelProps {
  isSandbox: boolean;
  isDemo: boolean;
  configPath: string;
  web3SpaceId?: number;
}

export const SpaceStateLabel = ({
  isSandbox,
  isDemo,
  configPath,
  web3SpaceId,
}: SpaceStateLabelProps) => {
  const { isAuthenticated } = useAuthentication();
  const { isMember } = useJoinSpace({ spaceId: web3SpaceId as number });
  const isDisabled = !isAuthenticated || !isMember;
  return (
    <div className="flex ml-3">
      {isSandbox ? (
        <Link
          className={isDisabled ? 'cursor-not-allowed' : ''}
          href={isAuthenticated && isMember ? configPath : {}}
          title="Change Space Configuration"
        >
          <Button disabled={isDisabled} colorVariant="accent" variant="outline">
            <span className="hidden sm:flex">Sandbox</span>
          </Button>
        </Link>
      ) : isDemo ? (
        <Link
          className={isDisabled ? 'cursor-not-allowed' : ''}
          href={isAuthenticated && isMember ? configPath : {}}
          title="Change Space Configuration"
        >
          <Button disabled={isDisabled} colorVariant="accent" variant="outline">
            <span className="hidden sm:flex">Pilot</span>
          </Button>
        </Link>
      ) : null}
    </div>
  );
};
