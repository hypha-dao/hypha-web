'use client';

import { Button } from '@hypha-platform/ui';
import { useJoinSpace } from '../hooks/use-join-space';
import { PersonIcon } from '@radix-ui/react-icons';
import React from 'react';
import { Loader2 } from 'lucide-react';
import { useSpaceDetailsWeb3Rpc } from '@core/space';

type JoinSpaceProps = {
  spaceId: number;
};

export const JoinSpace = ({ spaceId }: JoinSpaceProps) => {
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({ spaceId: spaceId });
  const isInviteOnly = spaceDetails?.joinMethod === 2n;

  const { isMember, isLoading, joinSpace, revalidateIsMember, isJoiningSpace } =
    useJoinSpace({
      spaceId,
    });

  const handleJoinSpace = React.useCallback(async () => {
    await joinSpace();
    revalidateIsMember();
  }, [joinSpace, revalidateIsMember]);

  return (
    <Button
      disabled={isMember || isLoading || isJoiningSpace}
      onClick={handleJoinSpace}
      className="ml-2 rounded-lg"
      colorVariant={isMember ? 'neutral' : 'accent'}
      variant={isMember ? 'outline' : 'default'}
    >
      {isJoiningSpace ? (
        <Loader2 className="mr-2 animate-spin" width={16} height={16} />
      ) : (
        <PersonIcon className="mr-2" width={16} height={16} />
      )}
      {isMember
        ? 'Already member'
        : isInviteOnly
        ? 'Request Invite'
        : 'Become member'}
    </Button>
  );
};
