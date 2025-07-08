'use client';

import { Button } from '@hypha-platform/ui';
import { useJoinSpace } from '../hooks/use-join-space';
import { PersonIcon } from '@radix-ui/react-icons';
import React from 'react';
import { Loader2 } from 'lucide-react';
import { useSpaceDetailsWeb3Rpc } from '@core/space';
import { useMe, useJwt } from '@core/people';
import { useAddMemberOrchestrator } from '@core/governance';
import { useConfig } from 'wagmi';

type JoinSpaceProps = {
  spaceId: number;
};

export const JoinSpace = ({ spaceId }: JoinSpaceProps) => {
  const config = useConfig();
  const { jwt } = useJwt();
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({ spaceId: spaceId });
  const isInviteOnly = spaceDetails?.joinMethod === 2n;

  const { person } = useMe();

  const { isMember, isLoading, joinSpace, revalidateIsMember, isJoiningSpace } =
    useJoinSpace({
      spaceId,
    });

  const { requestInvite, isCreating } = useAddMemberOrchestrator({
    authToken: jwt,
    config: config,
    spaceId: spaceId,
    memberAddress: person?.address as `0x${string}`,
  });

  const handleJoinSpace = React.useCallback(async () => {
    if (isInviteOnly) {
      console.log('123123');
      await requestInvite({
        spaceId: spaceId,
        title: 'Invite Member',
        description: `To onboard this member, we need as a space to approve this proposal. Member ${person?.name} ${person?.surname} [${person?.address}]`,
        creatorId: person?.id as number,
      });
    } else {
      await joinSpace();
      revalidateIsMember();
    }
  }, [joinSpace, revalidateIsMember]);

  return (
    <Button
      disabled={isMember || isLoading || isJoiningSpace || isCreating}
      onClick={handleJoinSpace}
      className="ml-2 rounded-lg"
      colorVariant={isMember ? 'neutral' : 'accent'}
      variant={isMember ? 'outline' : 'default'}
    >
      {isJoiningSpace || isCreating ? (
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
