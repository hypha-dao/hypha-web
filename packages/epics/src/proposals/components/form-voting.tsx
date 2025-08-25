import { Button, Skeleton, Separator } from '@hypha-platform/ui';
import { ProgressLine } from './progress-line';
import { intervalToDuration, isPast } from 'date-fns';
import { VoterList } from '../../governance/components/voter-list';
import { useMyVote } from '@hypha-platform/core/client';

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
  isVoting,
  documentSlug,
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
  isVoting?: boolean;
  documentSlug: string;
}) => {
  const { myVote } = useMyVote(documentSlug);
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
            label="Unity"
            value={unity}
            indicatorColor="bg-accent-9"
          />
        </Skeleton>
        <Skeleton
          width="100%"
          height="28px"
          loading={isLoading}
          className="rounded-lg"
        >
          <ProgressLine
            label="Quorum"
            value={quorum}
            indicatorColor="bg-accent-12"
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
              <Button onClick={onCheckProposalExpiration}>Expire</Button>
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
                    onClick={onReject}
                    disabled={isVoting}
                  >
                    Vote no
                  </Button>
                  <Button onClick={onAccept} disabled={isVoting}>
                    Vote yes
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
