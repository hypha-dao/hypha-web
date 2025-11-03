'use client';

import { Button, ErrorAlert } from '@hypha-platform/ui';
import { useJoinSpace } from '../hooks/use-join-space';
import { PersonIcon } from '@radix-ui/react-icons';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import {
  useSpaceDetailsWeb3Rpc,
  useMe,
  useJwt,
  useAddMemberOrchestrator,
  useCreateEvent,
  Person,
} from '@hypha-platform/core/client';
import { BaseError, useConfig } from 'wagmi';
import { useParams } from 'next/navigation';
import { useInviteStatus } from '../hooks';
import { useAuthentication } from '@hypha-platform/authentication';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [inviteRequested, setInviteRequested] = useState(false);
  const [justJoined, setJustJoined] = useState(false);

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
    agreement,
  } = useAddMemberOrchestrator({
    authToken: jwt,
    config,
    spaceId: web3SpaceId,
    memberAddress: person?.address as `0x${string}`,
  });
  const { createEvent } = useCreateEvent({ authToken: jwt });

  const { revalidateInviteStatus, isInviteLoading, lastInviteTime } =
    useInviteStatus({
      spaceId: BigInt(web3SpaceId),
      address: person?.address as `0x${string}`,
    });

  const profilePageUrl = `/${lang}/profile/${person?.slug}`;

  useEffect(() => {
    if (isInviteError) {
      setIsProcessing(false);
    }
  }, [isInviteError]);

  useEffect(() => {
    if (!isJoiningSpace && !isInviteOnly && agreement) {
      setIsProcessing(false);
    }
  }, [isJoiningSpace, isInviteOnly, agreement]);

  const createJoinEvent = React.useCallback(
    async ({ spaceId, person }: { spaceId: number; person: Person }) => {
      if (!spaceId || !person?.address) {
        return;
      }
      await createEvent({
        type: 'joinSpace',
        referenceEntity: 'space',
        referenceId: spaceId,
        parameters: { memberAddress: person.address },
      });
    },
    [createEvent],
  );

  const handleJoinSpace = useCallback(async () => {
    setJoinError(null);
    setIsProcessing(true);

    if (!person?.id || !person?.address) {
      const err = {
        shortMessage: 'User data not available',
      } as BaseError;
      setJoinError(err);
      setIsProcessing(false);
      return;
    }

    try {
      if (isInviteOnly) {
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
        setInviteRequested(true);
        revalidateInviteStatus();
        setIsProcessing(false);
      } else {
        await joinSpace();
        await createJoinEvent({ spaceId, person });
        setJustJoined(true);
        await revalidateIsMember();
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('Error joining space:', err);
      setIsProcessing(false);
      setJustJoined(false);
      if (isBaseError(err)) {
        setJoinError(err as BaseError);
      } else {
        setJoinError({
          shortMessage: 'An unexpected error occurred while joining the space',
        } as BaseError);
      }
    }
  }, [
    isInviteOnly,
    requestInvite,
    joinSpace,
    revalidateIsMember,
    spaceId,
    person,
    profilePageUrl,
    revalidateInviteStatus,
    createJoinEvent,
  ]);

  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

  const isInvitePending = useMemo(() => {
    if (!isInviteOnly) return false;
    if (inviteRequested) return true;
    if (!lastInviteTime) return false;
    return Date.now() - lastInviteTime < FORTY_EIGHT_HOURS_MS;
  }, [isInviteOnly, inviteRequested, lastInviteTime]);

  const buttonTitle = useMemo(() => {
    if (isMember || justJoined) return 'Already member';
    if (isInviteOnly) {
      if (isInvitePending) return 'Invite pending';
      return 'Request Invite';
    }
    return 'Become member';
  }, [isMember, justJoined, isInviteOnly, isInvitePending]);

  const showLoader = isProcessing || isJoiningSpace || isCreating;
  const isButtonDisabled =
    isMember ||
    justJoined ||
    isLoading ||
    isInviteLoading ||
    isInvitePending ||
    showLoader;

  const { isAuthenticated } = useAuthentication();

  return (
    <div className="flex flex-col gap-2">
      <Button
        disabled={isButtonDisabled || !isAuthenticated}
        onClick={handleJoinSpace}
        className="rounded-lg min-w-[120px]"
        colorVariant={isMember || justJoined ? 'neutral' : 'accent'}
        variant={isMember || justJoined ? 'outline' : 'default'}
        title={
          !isAuthenticated ? 'Please sign in to use this feature.' : buttonTitle
        }
      >
        {showLoader ? (
          <Loader2 className="animate-spin" width={16} height={16} />
        ) : (
          <PersonIcon width={16} height={16} />
        )}
        <span className="hidden sm:block ml-2">{buttonTitle}</span>
      </Button>

      {isInviteOnly && isInviteError && (
        <ErrorAlert
          bgColor="bg-neutral-9"
          lines={[
            'You’ve already submitted your invite request. Your proposal is now visible for review by the space members.',
          ]}
        />
      )}
      {isTokenBased && joinError && (
        <ErrorAlert
          bgColor="bg-neutral-9"
          lines={[
            'You’re not able to join just yet. Fulfil the token requirements to gain access.',
          ]}
        />
      )}
    </div>
  );
};
