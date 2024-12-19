import { Button } from '@hypha-platform/ui';
import { ProgressLine } from './progress-line';
import { intervalToDuration, isPast } from 'date-fns';

function formatTimeRemaining(endDate: string): string {
  const end = new Date(endDate);

  if (isPast(end)) {
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
  date,
  onAccept,
  onReject,
}: {
  unity: number;
  quorum: number;
  date: string;
  onAccept: () => void;
  onReject: () => void;
}) => {
  return (
    <div className="flex flex-col gap-5 text-neutral-11">
      <div className="flex flex-col gap-4">
        <ProgressLine
          label="Unity"
          value={unity}
          indicatorColor="bg-accent-9"
        />
        <ProgressLine
          label="Quorum"
          value={quorum}
          indicatorColor="bg-accent-12"
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="text-1">{formatTimeRemaining(date)}</div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onReject}>
            Vote no
          </Button>
          <Button onClick={onAccept}>Vote yes</Button>
        </div>
      </div>
    </div>
  );
};
