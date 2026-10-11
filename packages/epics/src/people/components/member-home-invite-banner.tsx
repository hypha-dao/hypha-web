'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { BaseError, useConfig } from 'wagmi';
import { Button } from '@hypha-platform/ui';
import type { Locale } from '@hypha-platform/i18n';
import {
  useAddMemberOrchestrator,
  useCreateEvent,
  useJwt,
  useMe,
  useSpaceDetailsWeb3Rpc,
  useSpacesByWeb3Ids,
  type MemberSpaceInvite,
} from '@hypha-platform/core/client';

import { useInviteStatus } from '../../spaces/hooks/use-invite-status';
import { useJoinSpace } from '../../spaces/hooks/use-join-space';

const EMPTY_WEB3_IDS: readonly bigint[] = [];
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

function MemberHomeInviteBanner({
  lang,
  invite,
}: {
  lang: Locale;
  invite: MemberSpaceInvite;
}) {
  const t = useTranslations('MemberHome');
  const tSpaces = useTranslations('Spaces');
  const config = useConfig();
  const { jwt } = useJwt();
  const { person } = useMe();
  const web3SpaceId = invite.web3SpaceId;
  const { spaceDetails, isLoading: isSpaceLoading } = useSpaceDetailsWeb3Rpc({
    spaceId: web3SpaceId,
  });
  const { spaces: spacesByWeb3Id } = useSpacesByWeb3Ids(
    web3SpaceId != null ? [BigInt(web3SpaceId)] : EMPTY_WEB3_IDS,
    false,
  );
  const spaceLeadImage = spacesByWeb3Id[0]?.leadImage?.trim() || undefined;
  const isInviteOnly = spaceDetails?.joinMethod === 2n;
  const isTokenBased = spaceDetails?.joinMethod === 1n;
  const [inviteRequested, setInviteRequested] = useState(false);
  const [justJoined, setJustJoined] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorLine, setErrorLine] = useState<string | null>(null);

  const { joinSpace, isJoiningSpace } = useJoinSpace({
    spaceId: web3SpaceId ?? undefined,
  });
  const {
    requestInvite,
    isCreating,
    isError: isInviteError,
  } = useAddMemberOrchestrator({
    authToken: jwt,
    config,
    spaceId: web3SpaceId ?? undefined,
    memberAddress: person?.address as `0x${string}` | undefined,
  });
  const { createEvent } = useCreateEvent({ authToken: jwt });
  const { revalidateInviteStatus, isInviteLoading, lastInviteTime } =
    useInviteStatus({
      spaceId: BigInt(web3SpaceId ?? 0),
      address:
        web3SpaceId != null
          ? (person?.address as `0x${string}` | undefined)
          : undefined,
    });

  useEffect(() => {
    if (isInviteError) setIsProcessing(false);
  }, [isInviteError]);

  const isInvitePending = useMemo(() => {
    if (!isInviteOnly) return false;
    if (inviteRequested) return true;
    if (!lastInviteTime) return false;
    return Date.now() - lastInviteTime < FORTY_EIGHT_HOURS_MS;
  }, [isInviteOnly, inviteRequested, lastInviteTime]);

  const spaceHref = `/${lang}/dho/${
    invite.spaceSlug
  }/overview?invite=${encodeURIComponent(invite.token)}`;

  const accept = useCallback(async () => {
    setErrorLine(null);
    if (web3SpaceId == null || !person?.id || !person.address) {
      setErrorLine(tSpaces('inviteAlreadySubmitted'));
      return;
    }
    setIsProcessing(true);
    const profilePageUrl = `/${lang}/profile/${person.slug}`;
    try {
      if (isInviteOnly) {
        await requestInvite({
          spaceId: invite.spaceId,
          title: 'Invite Member',
          description: `**${person.name} ${person.surname} has just requested to join as a member!**

        To move forward with onboarding, we'll need our space's approval on this proposal.

        You can review ${person.name}'s profile <span className="text-accent-9">[here](${profilePageUrl}).</span>`,
          creatorId: person.id,
          memberAddress: person.address as `0x${string}`,
          slug: `invite-request-${invite.spaceId}-${Date.now()}`,
          label: 'Invite',
          ...(spaceLeadImage ? { leadImage: spaceLeadImage } : {}),
        });
        setInviteRequested(true);
        revalidateInviteStatus();
      } else {
        await joinSpace();
        await createEvent({
          type: 'joinSpace',
          referenceEntity: 'space',
          referenceId: invite.spaceId,
          parameters: { memberAddress: person.address },
        });
        setJustJoined(true);
      }
    } catch (error) {
      if (isBaseError(error)) {
        setErrorLine(error.shortMessage);
      } else if (isTokenBased) {
        setErrorLine(tSpaces('tokenRequirements'));
      } else {
        setErrorLine(tSpaces('inviteAlreadySubmitted'));
      }
    } finally {
      setIsProcessing(false);
    }
  }, [
    createEvent,
    invite.spaceId,
    isInviteOnly,
    isTokenBased,
    joinSpace,
    lang,
    person,
    requestInvite,
    revalidateInviteStatus,
    spaceLeadImage,
    tSpaces,
    web3SpaceId,
  ]);

  const showLoader = isProcessing || isJoiningSpace || isCreating;
  const settled = justJoined || isInvitePending;
  const label = justJoined
    ? t('inviteJoined')
    : isInvitePending
    ? t('inviteSent')
    : t('inviteAccept');

  return (
    <div className="flex flex-col items-stretch gap-3 border border-border bg-background-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <ExclamationTriangleIcon
          width={14}
          height={14}
          className="mt-1 shrink-0 text-neutral-11"
          aria-hidden
        />
        <div className="min-w-0">
          <p
            className="text-3 leading-snug text-foreground"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {t('inviteBannerTitle', { space: invite.spaceTitle })}
          </p>
          <p className="mt-1 text-1 leading-relaxed text-neutral-11">
            {t('inviteBannerBody')}
          </p>
          <Link
            href={spaceHref}
            className="mt-1 inline-block text-1 text-neutral-11 underline-offset-2 hover:underline"
          >
            {t('inviteOpenSpace')}
          </Link>
          {errorLine ? (
            <p className="mt-1 text-1 text-error-11" role="alert">
              {errorLine}
            </p>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        className="shrink-0"
        disabled={
          settled ||
          showLoader ||
          isInviteLoading ||
          isSpaceLoading ||
          spaceDetails == null ||
          web3SpaceId == null ||
          !person?.address
        }
        onClick={() => {
          void accept();
        }}
      >
        {label}
      </Button>
    </div>
  );
}

export function MemberHomeInviteBanners({
  lang,
  invites,
}: {
  lang: Locale;
  invites: MemberSpaceInvite[];
}) {
  if (invites.length === 0) return null;
  return (
    <div className="mb-4 grid gap-3">
      {invites.map((invite) => (
        <MemberHomeInviteBanner key={invite.id} lang={lang} invite={invite} />
      ))}
    </div>
  );
}
