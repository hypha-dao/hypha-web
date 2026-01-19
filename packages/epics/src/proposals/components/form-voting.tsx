'use client';

import { Button, Skeleton, Separator, Image } from '@hypha-platform/ui';
import { WithdrawResubmitBanner } from './withdraw-resubmit-banner';
import { ProgressLine } from './progress-line';
import { intervalToDuration, isPast } from 'date-fns';
import { VoterList } from '../../governance/components/voter-list';
import {
  useMyVote,
  useIsDelegate,
  type SpaceDetails,
  useMe,
  useWithdrawProposal,
} from '@hypha-platform/core/client';
import { useSpaceMember } from '../../spaces';
import { useSpaceMinProposalDuration } from '@hypha-platform/core/client';
import { formatDuration } from '@hypha-platform/ui-utils';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

function formatTimeRemaining(
  endTime: string,
  executed?: boolean,
  expired?: boolean,
): string {
  const end = new Date(endTime);

  if (isPast(end) || executed || expired) {
    return 'Vote closed';
  }

  const duration = intervalToDuration({
    start: new Date(),
    end,
  });

  const parts = [];
  if (duration.days) parts.push(`${duration.days}d`);
  if (duration.hours) parts.push(`${duration.hours}h`);
  if (duration.minutes) parts.push(`${duration.minutes}m`);

  return parts.length
    ? `This vote will close in ${parts.join(' ')}`
    : 'Vote closing soon';
}

const getCreateRouteForLabel = (label: string | undefined): string => {
  if (!label) return '';

  const labelToRoute: Record<string, string> = {
    Contribution: 'propose-contribution',
    'Collective Agreement': '',
    Expenses: 'pay-for-expenses',
    Funding: 'deploy-funds',
    'Voting Method': 'change-voting-method',
    'Entry Method': 'change-entry-method',
    'Issue New Token': 'issue-new-token',
    'Buy Hypha Tokens': 'buy-hypha-tokens',
    'Activate Spaces': 'activate-spaces',
    'Space To Space': 'space-to-space-membership',
    'Treasury Minting': 'mint-tokens-to-space-treasury',
    'Membership Exit': 'membership-exit',
  };

  return labelToRoute[label] || '';
};

export const FormVoting = ({
  unity,
  quorum,
  endTime,
  executed,
  expired,
  isLoading,
  onAccept,
  onReject,
  isCheckingExpiration,
  isVoting,
  documentSlug,
  isAuthenticated,
  web3SpaceId,
  spaceDetails,
  proposalStatus,
  hideDurationData,
  proposalId,
  proposalCreator,
  onWithdrawSuccess,
  documentTitle,
  documentDescription,
  documentLeadImage,
  documentAttachments,
  spaceSlug,
  closeUrl,
  label,
}: {
  unity: number;
  quorum: number;
  endTime: string;
  expired?: boolean;
  executed?: boolean;
  isLoading?: boolean;
  onAccept: () => void;
  onReject: () => void;
  isCheckingExpiration: boolean;
  isVoting?: boolean;
  documentSlug: string;
  isAuthenticated?: boolean;
  web3SpaceId?: number;
  spaceDetails?: SpaceDetails;
  proposalStatus?: string | null;
  hideDurationData?: boolean;
  proposalId?: number | null;
  proposalCreator?: `0x${string}` | null;
  onWithdrawSuccess?: () => void;
  documentTitle?: string;
  documentDescription?: string;
  documentLeadImage?: string;
  documentAttachments?: (string | { name: string; url: string })[];
  spaceSlug?: string;
  closeUrl?: string;
  label?: string;
}) => {
  const { myVote } = useMyVote(documentSlug);
  const { isMember } = useSpaceMember({ spaceId: web3SpaceId as number });
  const { isDelegate } = useIsDelegate({ spaceId: web3SpaceId as number });
  const { theme } = useTheme();
  const { person } = useMe();
  const router = useRouter();
  const params = useParams();
  const lang = params?.lang as string;
  const { withdrawProposal, isWithdrawing } = useWithdrawProposal({
    proposalId: proposalId ?? null,
  });

  const [localVote, setLocalVote] = useState<'no' | 'yes' | null>(null);

  const isCreator = Boolean(
    proposalCreator &&
      person?.address &&
      proposalCreator.toLowerCase() === person.address.toLowerCase(),
  );

  const showWithdrawBlock =
    isCreator &&
    !executed &&
    !expired &&
    !isPast(new Date(endTime)) &&
    proposalStatus === 'onVoting';

  const handleWithdraw = async () => {
    try {
      await withdrawProposal();
      await onWithdrawSuccess?.();
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (closeUrl) {
        router.push(closeUrl);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error('Error withdrawing proposal:', error);
    }
  };

  const handleResubmit = async () => {
    try {
      const proposalData = {
        title: documentTitle || '',
        description: documentDescription || '',
        leadImage: documentLeadImage || undefined,
        attachments: documentAttachments || undefined,
      };

      sessionStorage.setItem(
        'resubmitProposalData',
        JSON.stringify(proposalData),
      );

      const saved = sessionStorage.getItem('resubmitProposalData');
      if (!saved) {
        console.error('Failed to save resubmit data to sessionStorage');
        return;
      }

      await withdrawProposal();
      await onWithdrawSuccess?.();

      await new Promise((resolve) => setTimeout(resolve, 200));

      if (spaceSlug && lang) {
        const routePath = getCreateRouteForLabel(label);

        let createPath: string;
        if (routePath === '') {
          createPath = `/${lang}/dho/${spaceSlug}/agreements/create`;
        } else {
          createPath = `/${lang}/dho/${spaceSlug}/agreements/create/${routePath}`;
        }

        router.push(createPath);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error('Error resubmitting proposal:', error);
      sessionStorage.removeItem('resubmitProposalData');
      sessionStorage.removeItem('resubmitFormData');
    }
  };

  const isDisabled =
    isVoting ||
    !isAuthenticated ||
    isCheckingExpiration ||
    (!isMember && !isDelegate);
  const tooltipMessage = !isAuthenticated
    ? 'Please sign in to use this feature.'
    : !isMember && !isDelegate
    ? 'Please join this space to use this feature.'
    : '';

  function getVoteLabels(spaceDetails?: SpaceDetails) {
    if (!spaceDetails) {
      return { reject: 'Vote no', accept: 'Vote yes' };
    }

    const quorum = Number(spaceDetails.quorum);
    const unity = Number(spaceDetails.unity);

    if (quorum === 0 && unity === 100) {
      return { reject: 'Object', accept: 'Consent' };
    }

    if (quorum === 100 && unity === 100) {
      return { reject: 'No', accept: 'Hell yeah' };
    }

    if (quorum === 100 && unity === 0) {
      return { reject: 'Not sure', accept: 'Looks good' };
    }

    return { reject: 'Vote no', accept: 'Vote yes' };
  }

  const labels = getVoteLabels(spaceDetails);

  const hideTargets = () => {
    return proposalStatus === 'accepted' || proposalStatus === 'rejected';
  };

  const spaceIdBigInt = web3SpaceId ? BigInt(web3SpaceId) : undefined;

  const { duration } = useSpaceMinProposalDuration({
    spaceId: spaceIdBigInt as bigint,
  });

  const handleAccept = () => {
    setLocalVote('yes');
    onAccept();
  };

  const handleReject = () => {
    setLocalVote('no');
    onReject();
  };

  const showVotedMessage = myVote || localVote;
  const voteText = myVote || localVote;

  const isRejectDisabled = isDisabled || voteText === 'no';
  const isAcceptDisabled = isDisabled || voteText === 'yes';

  return (
    <div className="flex flex-col gap-7 text-neutral-11">
      <VoterList documentSlug={documentSlug} />
      <div className="flex flex-col gap-6">
        <Skeleton
          width="100%"
          height="28px"
          loading={isLoading}
          className="rounded-lg"
        >
          <ProgressLine
            label="Quorum (Min. Participation)"
            value={quorum}
            target={
              spaceDetails?.quorum ? Number(spaceDetails.quorum) : undefined
            }
            indicatorColor="bg-accent-12"
            hideTargets={hideTargets()}
          />
        </Skeleton>
        <Skeleton
          width="100%"
          height="28px"
          loading={isLoading}
          className="rounded-lg"
        >
          <ProgressLine
            label="Unity (Min. Alignment)"
            value={unity}
            target={
              spaceDetails?.unity ? Number(spaceDetails.unity) : undefined
            }
            indicatorColor="bg-accent-9"
            hideTargets={hideTargets()}
          />
        </Skeleton>
      </div>
      <div className="flex items-end justify-between">
        <Skeleton
          width="100%"
          height="28px"
          loading={isLoading}
          className="rounded-lg"
        >
          <div className="flex flex-col gap-3">
            <Skeleton
              loading={isLoading}
              width={120}
              height={40}
              className="rounded-lg"
            >
              {hideDurationData ? null : Number(duration) === 0 ? (
                <div className="flex gap-2 h-fit items-center">
                  <Image
                    className="max-w-[24px] max-h-[24px] min-w-[24px] min-h-[24px]"
                    width={24}
                    height={24}
                    src={
                      theme === 'light'
                        ? '/placeholder/auto-execution-icon-light.svg'
                        : '/placeholder/auto-execution-icon.svg'
                    }
                    alt="Proposal minimum voting icon"
                  />
                  <div className="flex flex-col">
                    <span className="text-1 text-accent-11 text-nowrap font-medium">
                      Auto-Execution
                    </span>
                    <span className="text-[9px] text-accent-11 text-nowrap font-medium">
                      {spaceDetails?.quorum}% Quorum | {spaceDetails?.unity}%
                      Unity
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 h-fit items-center">
                  <Image
                    className="max-w-[24px] max-h-[24px] min-w-[24px] min-h-[24px]"
                    width={24}
                    height={24}
                    src={
                      theme === 'light'
                        ? '/placeholder/non-auto-execution-icon-light.svg'
                        : '/placeholder/non-auto-execution-icon.svg'
                    }
                    alt="Proposal minimum voting icon"
                  />
                  <div className="flex flex-col">
                    <span className="text-1 text-accent-11 text-nowrap font-medium">
                      {formatDuration(Number(duration))} to Vote
                    </span>
                    <span className="text-[9px] text-accent-11 text-nowrap font-medium">
                      {spaceDetails?.quorum}% Quorum | {spaceDetails?.unity}%
                      Unity
                    </span>
                  </div>
                </div>
              )}
            </Skeleton>
            <div className="text-1">
              {formatTimeRemaining(endTime, executed, expired)}
            </div>
          </div>
          {executed || expired || isPast(new Date(endTime)) ? null : (
            <div className="flex flex-col gap-2 items-end">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  colorVariant="accent"
                  className="active:bg-accent-9"
                  onClick={handleReject}
                  disabled={isRejectDisabled}
                  title={tooltipMessage}
                >
                  {labels.reject}
                </Button>
                <Button
                  variant="outline"
                  colorVariant="accent"
                  className="active:bg-accent-9"
                  onClick={handleAccept}
                  disabled={isAcceptDisabled}
                  title={tooltipMessage}
                >
                  {labels.accept}
                </Button>
              </div>
              {showVotedMessage && (
                <div className="text-2 text-neutral-10">
                  You voted {voteText}
                </div>
              )}
            </div>
          )}
        </Skeleton>
      </div>
      {showWithdrawBlock && (
        <WithdrawResubmitBanner
          onWithdraw={handleWithdraw}
          onResubmit={handleResubmit}
          isWithdrawing={isWithdrawing}
        />
      )}
    </div>
  );
};
