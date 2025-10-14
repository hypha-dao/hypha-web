import { Button, Skeleton, Separator } from '@hypha-platform/ui';
import { ProgressLine } from './progress-line';
import { intervalToDuration, isPast } from 'date-fns';
import { VoterList } from '../../governance/components/voter-list';
import {
  useMyVote,
  useIsDelegate,
  type SpaceDetails,
} from '@hypha-platform/core/client';
import { useJoinSpace } from '../../spaces';

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
}) => {
  const { myVote } = useMyVote(documentSlug);
  const { isMember } = useJoinSpace({ spaceId: web3SpaceId as number });
  const { isDelegate } = useIsDelegate({ spaceId: web3SpaceId as number });

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
      return { reject: 'Not sure', accept: 'Look good' };
    }

    return { reject: 'Vote no', accept: 'Vote yes' };
  }

  const labels = getVoteLabels(spaceDetails);

  return (
    <div className="flex flex-col gap-5 text-neutral-11">
      <VoterList documentSlug={documentSlug} />
      <Separator />
      <div className="flex flex-col gap-4">
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
          />
        </Skeleton>
      </div>
      <div className="flex items-center justify-between">
        <Skeleton
          width="100%"
          height="28px"
          loading={isLoading}
          className="rounded-lg"
        >
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
