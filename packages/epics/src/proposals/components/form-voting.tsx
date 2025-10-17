'use client';

import { Button, Skeleton, Separator, Image } from '@hypha-platform/ui';
import { ProgressLine } from './progress-line';
import { intervalToDuration, isPast } from 'date-fns';
import { VoterList } from '../../governance/components/voter-list';
import {
  useMyVote,
  useIsDelegate,
  type SpaceDetails,
} from '@hypha-platform/core/client';
import { useJoinSpace } from '../../spaces';
import { useSpaceMinProposalDuration } from '@hypha-platform/core/client';
import { durationInDays } from '@hypha-platform/ui-utils';
import { useTheme } from 'next-themes';

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

export const FormVoting = ({
  unity,
  quorum,
  endTime,
  executed,
  expired,
  isLoading,
  onAccept,
  onReject,
  onCheckProposalExpiration,
  isCheckingExpiration,
  isVoting,
  documentSlug,
  isAuthenticated,
  web3SpaceId,
  spaceDetails,
  proposalStatus,
  hideDurationData,
}: {
  unity: number;
  quorum: number;
  endTime: string;
  expired?: boolean;
  executed?: boolean;
  isLoading?: boolean;
  onAccept: () => void;
  onReject: () => void;
  onCheckProposalExpiration: () => void;
  isCheckingExpiration: boolean;
  isVoting?: boolean;
  documentSlug: string;
  isAuthenticated?: boolean;
  web3SpaceId?: number;
  spaceDetails?: SpaceDetails;
  proposalStatus?: string | null;
  hideDurationData?: boolean;
}) => {
  const { myVote } = useMyVote(documentSlug);
  const { isMember } = useJoinSpace({ spaceId: web3SpaceId as number });
  const { isDelegate } = useIsDelegate({ spaceId: web3SpaceId as number });
  const { theme } = useTheme();

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

  return (
    <div className="flex flex-col gap-7 text-neutral-11">
      <VoterList documentSlug={documentSlug} />
      <Separator />
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
                        ? '/placeholder/auto-execution-icon-light.png'
                        : '/placeholder/auto-execution-icon.png'
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
                        ? '/placeholder/non-auto-execution-icon-light.png'
                        : '/placeholder/non-auto-execution-icon.png'
                    }
                    alt="Proposal minimum voting icon"
                  />
                  <div className="flex flex-col">
                    <span className="text-1 text-accent-11 text-nowrap font-medium">
                      {durationInDays({ duration: duration })} Days to Vote
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
            {isPast(new Date(endTime)) && !executed && !expired ? (
              <div className="flex gap-2">
                <Button
                  onClick={onCheckProposalExpiration}
                  disabled={isDisabled}
                  title={tooltipMessage}
                >
                  Execute
                </Button>
              </div>
            ) : null}
          </div>
          {executed || expired || isPast(new Date(endTime)) ? null : (
            <div className="flex gap-2">
              {myVote ? (
                <div className="text-sm text-neutral-10">
                  You already voted {myVote}
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    colorVariant="accent"
                    className="active:bg-accent-9"
                    onClick={onReject}
                    disabled={isDisabled}
                    title={tooltipMessage}
                  >
                    {labels.reject}
                  </Button>
                  <Button
                    variant="outline"
                    colorVariant="accent"
                    className="active:bg-accent-9"
                    onClick={onAccept}
                    disabled={isDisabled}
                    title={tooltipMessage}
                  >
                    {labels.accept}
                  </Button>
                </>
              )}
            </div>
          )}
        </Skeleton>
      </div>
    </div>
  );
};
