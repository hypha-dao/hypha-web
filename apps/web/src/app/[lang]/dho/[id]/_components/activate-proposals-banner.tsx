'use client';

import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useSalesBanner } from '@hypha-platform/epics';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

interface ActivateProposalsBannerProps {
  spaceSlug: string;
  className?: string;
}

export const ActivateProposalsBanner = ({
  spaceSlug,
  className,
}: ActivateProposalsBannerProps) => {
  const { space, isLoading: isSpaceLoading } = useSpaceBySlug(spaceSlug);
  const { status, isLoading: isStatusLoading } = useSalesBanner({
    spaceId: space?.web3SpaceId ?? undefined,
  });

  if (isSpaceLoading || !space || isStatusLoading || !status) {
    return null;
  }

  if (status != 'expired') {
    return null;
  }

  const title = ''; //TODO
  const subtitle = ''; //TODO
  const isDisabled = true; //TODO
  const tooltipMessage = ''; //TODO
  const buttonText = ''; //TODO
  const handleAction = () => {}; //TODO

  return (
    <div
      className={cn(
        'border-1 rounded-[8px] bg-accent-surface bg-center border-accent-6',
        className,
      )}
    >
      <div className="p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <span className="text-2 font-bold text-foreground">{title}</span>
        </div>
        <span className={cn('text-2', 'text-foreground')}>{subtitle}</span>
        <Button
          disabled={isDisabled}
          title={tooltipMessage}
          onClick={handleAction}
          className="w-fit"
        >
          {buttonText}
        </Button>
      </div>
    </div>
  );
};
