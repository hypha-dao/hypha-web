'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useJoinSpace } from '@hypha-platform/epics';
import { Badge, Button } from '@hypha-platform/ui';
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
  return (
    <div className="flex ml-3">
      {isAuthenticated && isMember ? (
        <>
          {isSandbox ? (
            <Badge className="flex" colorVariant="accent" variant="outline">
              Sandbox
            </Badge>
          ) : isDemo ? (
            <Badge className="flex" colorVariant="accent" variant="outline">
              Template
            </Badge>
          ) : null}
        </>
      ) : (
        <>
          {isSandbox ? (
            <Link href={configPath} title="Change Space Configuration">
              <Button colorVariant="accent" variant="outline">
                <span className="hidden sm:flex">Sandbox</span>
              </Button>
            </Link>
          ) : isDemo ? (
            <Link href={configPath} title="Change Space Configuration">
              <Button colorVariant="accent" variant="outline">
                <span className="hidden sm:flex">Template</span>
              </Button>
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
};
