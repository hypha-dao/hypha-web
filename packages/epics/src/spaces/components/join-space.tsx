'use client';
import { Button, ErrorAlert } from '@hypha-platform/ui';
import { useJoinSpace } from '../hooks/use-join-space';
import { PersonIcon } from '@radix-ui/react-icons';
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSpaceDetailsWeb3Rpc } from '@core/space';
import { useMe, useJwt } from '@core/people';
import { useAddMemberOrchestrator } from '@core/governance';
import { BaseError, useConfig } from 'wagmi';

type JoinSpaceProps = {
  spaceId: number;
  web3SpaceId: number;
};

function isBaseError(error: any): error is BaseError {
  return (error as BaseError).details !== undefined;
}

export const JoinSpace = ({ spaceId, web3SpaceId }: JoinSpaceProps) => {
  const config = useConfig();
  const { jwt } = useJwt();
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({ spaceId: web3SpaceId });
  const [joinError, setJoinError] = useState<BaseError | null>(null);
  const isInviteOnly = spaceDetails?.joinMethod === 2n;
  const isTokenBased = spaceDetails?.joinMethod === 1n;

  const { person } = useMe();

  const { isMember, isLoading, joinSpace, revalidateIsMember, isJoiningSpace } =
    useJoinSpace({
      spaceId: web3SpaceId,
    });

  const {
    requestInvite,
    isCreating,
    isError: isInviteError,
    errors: inviteErrors,
  } = useAddMemberOrchestrator({
    authToken: jwt,
    config,
    spaceId: web3SpaceId,
    memberAddress: person?.address as `0x${string}`,
  });

  const handleJoinSpace = React.useCallback(async () => {
    setJoinError(null);
    if (isInviteOnly) {
      if (!person?.id || !person?.address) {
        console.error('User data not available for invite request');
        return;
      }
      await requestInvite({
        spaceId: spaceId,
        title: 'Invite Member',
        description: `To onboard this member, we need as a space to approve this proposal. Member ${person.name} ${person.surname} [${person.address}]`,
        creatorId: person.id,
        memberAddress: person.address as `0x${string}`,
        slug: `invite-request-${spaceId}-${Date.now()}`,
      });
    } else {
      try {
        await joinSpace();
      } catch (err) {
        console.error(err);
        if (isBaseError(err)) {
          setJoinError(err as BaseError);
        } else {
          // Handle other error types or set a generic error message
          setJoinError({
            details: 'An unexpected error occurred while joining the space',
          } as BaseError);
        }
      }
      revalidateIsMember();
    }
  }, [
    isInviteOnly,
    requestInvite,
    joinSpace,
    revalidateIsMember,
    spaceId,
    person,
  ]);

  const buttonTitle = isMember
    ? 'Already member'
    : isInviteOnly
    ? 'Request Invite'
    : 'Become member';

  return (
    <div>
      <Button
        disabled={isMember || isLoading || isJoiningSpace || isCreating}
        onClick={handleJoinSpace}
        className="rounded-lg"
        colorVariant={isMember ? 'neutral' : 'accent'}
        variant={isMember ? 'outline' : 'default'}
        title={buttonTitle}
      >
        {isJoiningSpace || isCreating ? (
          <Loader2 className="animate-spin" width={16} height={16} />
        ) : (
          <PersonIcon width={16} height={16} />
        )}
        <span className="hidden sm:block">{buttonTitle}</span>
      </Button>
      {isInviteOnly && isInviteError ? (
        <ErrorAlert lines={inviteErrors.map((err) => err.message)} />
      ) : (
        isTokenBased &&
        joinError && (
          <ErrorAlert
            lines={[`Token Based Entry fail: ${joinError.details}`]}
          />
        )
      )}
    </div>
  );
};
