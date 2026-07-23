'use client';

import { Button, ErrorAlert } from '@hypha-platform/ui';
import { useJoinSpace } from '../hooks/use-join-space';
import { PersonIcon } from '@radix-ui/react-icons';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useSpaceDetailsWeb3Rpc,
  useSpacesByWeb3Ids,
  useMe,
  useJwt,
  useAddMemberOrchestrator,
  useCreateEvent,
  useHookRegistry,
  Person,
} from '@hypha-platform/core/client';
import { BaseError, useConfig } from 'wagmi';
import { useParams } from 'next/navigation';
import { useInviteStatus, useSpaceMember } from '../hooks';
import { useAuthentication } from '@hypha-platform/authentication';
import { getDhoUrlAgreements } from '../../common';
import type { Locale } from '@hypha-platform/i18n';

type JoinSpaceProps = {
  /** DB space id — optional; resolved from web3SpaceId when omitted (FR-4 / D-2). */
  spaceId?: number;
  web3SpaceId: number;
  hideWhenMember?: boolean;
};

function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

export const JoinSpace = ({
  spaceId: spaceIdProp,
  web3SpaceId,
  hideWhenMember = false,
}: JoinSpaceProps) => {
  const t = useTranslations('Spaces');
  const { lang, id: spaceSlugParam } = useParams();
  const config = useConfig();
  const { jwt } = useJwt();
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({ spaceId: web3SpaceId });
  // Always resolve the space record so invite proposals can reuse its banner
  // even when callers already pass a DB spaceId.
  const { spaces: spacesByWeb3Id } = useSpacesByWeb3Ids(
    [BigInt(web3SpaceId)],
    false,
  );
  const spaceId = spaceIdProp ?? spacesByWeb3Id[0]?.id;
  const spaceLeadImage = spacesByWeb3Id[0]?.leadImage?.trim() || undefined;
  const [joinError, setJoinError] = useState<BaseError | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inviteRequested, setInviteRequested] = useState(false);
  const [justJoined, setJustJoined] = useState(false);

  const isInviteOnly = spaceDetails?.joinMethod === 2n;
  const isTokenBased = spaceDetails?.joinMethod === 1n;

  const { person } = useMe();

  const { joinSpace, isJoiningSpace } = useJoinSpace({
    spaceId: web3SpaceId,
  });
  const { isMember, isMemberLoading, revalidateIsMember } = useSpaceMember({
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

  const { useSendNotifications } = useHookRegistry();
  const { notifyProposalCreated } = useSendNotifications({ authToken: jwt });

  // Join requests bypass the proposal form, so the usual in-app notification
  // watcher (useProposalNotifications) never runs for them. Trigger the same
  // server action once the invite proposal id is known from the tx receipt.
  const inviteProposalId = agreement?.proposalId;
  const notifiedProposalIdRef = React.useRef<bigint | undefined>(undefined);
  useEffect(() => {
    if (
      !inviteRequested ||
      inviteProposalId === undefined ||
      !person?.address
    ) {
      return;
    }
    if (notifiedProposalIdRef.current === inviteProposalId) {
      return;
    }

    const url =
      typeof spaceSlugParam === 'string'
        ? getDhoUrlAgreements(lang as Locale, spaceSlugParam)
        : undefined;

    void notifyProposalCreated({
      proposalId: inviteProposalId,
      spaceId: BigInt(web3SpaceId),
      // On-chain ProposalCreated.creator is the space factory for join
      // requests; pass the requester so member notifications exclude them.
      creator: person.address as `0x${string}`,
      url,
    })
      .then(() => {
        notifiedProposalIdRef.current = inviteProposalId;
      })
      .catch((error) =>
        console.warn('Failed to send join request notifications:', error),
      );
  }, [
    inviteRequested,
    inviteProposalId,
    person?.address,
    notifyProposalCreated,
    lang,
    spaceSlugParam,
    web3SpaceId,
  ]);

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

  React.useEffect(() => {
    if (isMemberLoading || typeof isMember === 'undefined') {
      return;
    }
    if (isMember) {
      setJustJoined(false);
    }
  }, [isMember, isMemberLoading]);

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
        if (spaceId == null) {
          setJoinError({
            shortMessage: 'Space data not available yet. Please try again.',
          } as BaseError);
          setIsProcessing(false);
          return;
        }
        await requestInvite({
          spaceId,
          title: 'Invite Member',
          description: `**${person.name} ${person.surname} has just requested to join as a member!**

        To move forward with onboarding, we'll need our space's approval on this proposal.

        You can review ${person.name}'s profile <span className="text-accent-9">[here](${profilePageUrl}).</span>`,
          creatorId: person.id,
          memberAddress: person.address as `0x${string}`,
          slug: `invite-request-${spaceId}-${Date.now()}`,
          label: 'Invite',
          ...(spaceLeadImage ? { leadImage: spaceLeadImage } : {}),
        });
        setInviteRequested(true);
        revalidateInviteStatus();
        setIsProcessing(false);
      } else {
        await joinSpace();
        if (spaceId != null) {
          await createJoinEvent({ spaceId, person });
        }
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
    spaceLeadImage,
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
    if (isMember || justJoined) return t('alreadyMember');
    if (isInviteOnly) {
      if (isInvitePending) return t('invitePending');
      return t('requestInvite');
    }
    return t('becomeMember');
  }, [isMember, justJoined, isInviteOnly, isInvitePending, t]);

  const showLoader = isProcessing || isJoiningSpace || isCreating;
  const needsDbSpaceId = isInviteOnly && spaceId == null;
  const isButtonDisabled =
    isMember ||
    justJoined ||
    isMemberLoading ||
    isInviteLoading ||
    isInvitePending ||
    needsDbSpaceId ||
    showLoader;

  const { isAuthenticated } = useAuthentication();

  // Only hide once membership is confirmed — never blank the CTA while loading
  // (that regression made Become member / Request Invite disappear entirely).
  if (hideWhenMember && !isMemberLoading && (isMember || justJoined)) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        disabled={isButtonDisabled || !isAuthenticated}
        onClick={handleJoinSpace}
        className="min-w-[120px]"
        colorVariant={isMember || justJoined ? 'neutral' : 'accent'}
        variant={isMember || justJoined ? 'outline' : 'default'}
        title={!isAuthenticated ? t('signIn') : buttonTitle}
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
          lines={[t('inviteAlreadySubmitted')]}
        />
      )}
      {isTokenBased && joinError && (
        <ErrorAlert bgColor="bg-neutral-9" lines={[t('tokenRequirements')]} />
      )}
    </div>
  );
};
