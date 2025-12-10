'use client';

import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useSalesBanner } from '@hypha-platform/epics';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { cleanPath } from './clean-path';
import { usePathname, useRouter } from 'next/navigation';
import { PATH_SELECT_ACTIVATE_ACTION } from '@web/app/constants';

interface ActivateProposalsBannerProps {
  spaceSlug: string;
  className?: string;
}

export const ActivateProposalsBanner = ({
  spaceSlug,
  className,
}: ActivateProposalsBannerProps) => {
  const { space, isLoading: isSpaceLoading } = useSpaceBySlug(spaceSlug);
  const {
    status,
    daysLeft,
    isLoading: isStatusLoading,
  } = useSalesBanner({
    spaceId: space?.web3SpaceId ?? undefined,
  });
  const pathname = usePathname();
  const router = useRouter();

  if (isSpaceLoading || !space || isStatusLoading || !status) {
    return null;
  }

  if (status != 'expired') {
    return null;
  }

  const title = 'Proposal creation disabled';
  const subtitle = `Your Hypha Network contribution expired ${Math.abs(
    daysLeft,
  )} days ago. Please reactivate your space before submitting a new proposal.`;
  const buttonText = 'Reactivate Now';
  const handleAction = () => {
    const path = `${cleanPath(pathname)}${PATH_SELECT_ACTIVATE_ACTION}`;
    router.push(path);
  };

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
        <Button onClick={handleAction} className="w-fit">
          {buttonText}
        </Button>
      </div>
    </div>
  );
};
