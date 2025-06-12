import { Button, Skeleton } from '@hypha-platform/ui';
import { ProgressLine } from './progress-line';
import { intervalToDuration, isPast } from 'date-fns';

function formatTimeRemaining(endTime: string, executed?: boolean): string {
  const end = new Date(endTime);

  if (isPast(end) || executed) {
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
  isLoading,
  onAccept,
  onReject,
}: {
  unity: number;
  quorum: number;
  endTime: string;
  executed?: boolean;
  isLoading?: boolean;
  onAccept: () => void;
  onReject: () => void;
}) => {
  return (
    <div className="flex flex-col gap-5 text-neutral-11">
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
          <div className="text-1">{formatTimeRemaining(endTime, executed)}</div>
          {isPast(new Date(endTime)) || executed ? null : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={onReject}>
                Vote no
              </Button>
              <Button onClick={onAccept}>Vote yes</Button>
            </div>
          )}
        </Skeleton>
      </div>
    </div>
  );
};
