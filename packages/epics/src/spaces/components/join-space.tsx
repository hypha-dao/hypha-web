'use client';

import { Button, ErrorAlert } from '@hypha-platform/ui';
import { useJoinSpace } from '../hooks/use-join-space';
import { PersonIcon } from '@radix-ui/react-icons';
import React, { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import {
  useSpaceDetailsWeb3Rpc,
  useMe,
  useJwt,
  useAddMemberOrchestrator,
} from '@hypha-platform/core/client';
import { BaseError, useConfig } from 'wagmi';
import { useParams } from 'next/navigation';
import { useInviteStatus } from '../hooks';

type JoinSpaceProps = {
  spaceId: number;
  web3SpaceId: number;
};

function isBaseError(error: any): error is BaseError {
  return (error as BaseError).details !== undefined;
}

export const JoinSpace = ({ spaceId, web3SpaceId }: JoinSpaceProps) => {
  const { lang } = useParams();
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

  const { hasActiveProposal, revalidateInviteStatus } = useInviteStatus({
    spaceId: BigInt(web3SpaceId),
    address: person?.address as `0x${string}`,
  });

  const profilePageUrl = `/${lang}/profile/${person?.slug}`;

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
        description: `**${person.name} ${person.surname} has just requested to join as a member!**
      
      To move forward with onboarding, we'll need our space's approval on this proposal.
      
      You can review ${person.name}'s profile <span className="text-accent-9">[here](${profilePageUrl}).</span>`,
        creatorId: person.id,
        memberAddress: person.address as `0x${string}`,
        slug: `invite-request-${spaceId}-${Date.now()}`,
        label: 'Invite',
      });
      await revalidateInviteStatus();
    } else {
      if (!person?.id || !person?.address) {
        const err = {
          shortMessage: 'User is not authorized',
        } as BaseError;
        console.error(err);
        setJoinError(err);
        return;
      }
      try {
        await joinSpace();
        await revalidateIsMember();
      } catch (err) {
        console.error(err);
        if (isBaseError(err)) {
          setJoinError(err as BaseError);
        } else {
          setJoinError({
            shortMessage:
              'An unexpected error occurred while joining the space',
          } as BaseError);
        }
      }
    }
  }, [
    isInviteOnly,
    requestInvite,
    joinSpace,
    revalidateIsMember,
    spaceId,
    person,
  ]);

  const buttonTitle = useMemo(() => {
    if (isMember) return 'Already member';
    if (isInviteOnly) {
      if (hasActiveProposal) return 'Invite pending';
      return 'Request Invite';
    }
    return 'Become member';
  }, [isMember, isInviteOnly, hasActiveProposal]);
  const isInvitePending = isInviteOnly && hasActiveProposal;
  const isButtonDisabled =
    isMember || isLoading || isJoiningSpace || isCreating || isInvitePending;

  return (
    <div>
      <Button
        disabled={isButtonDisabled}
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
            lines={[`Token-based entry failed: ${joinError.shortMessage}`]}
          />
        )
      )}
    </div>
  );
};
