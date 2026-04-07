'use client';

import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useSalesBanner } from '@hypha-platform/epics';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { usePathname, useRouter } from 'next/navigation';
import { cleanPath } from '../utils/cleanPath';
import React from 'react';
import { useTranslations } from 'next-intl';

interface ActivateProposalsBannerProps {
  spaceSlug: string;
  activatePath: string;
  className?: string;
}

export const ActivateProposalsBanner = ({
  spaceSlug,
  activatePath,
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
  const t = useTranslations('Spaces');
  const pathname = usePathname();
  const router = useRouter();

  const handleAction = React.useCallback(() => {
    const path = `${cleanPath(pathname)}${activatePath}`;
    router.push(path);
  }, [router, activatePath, pathname]);

  if (isSpaceLoading || !space || isStatusLoading || !status) {
    return null;
  }

  if (status !== 'expired') {
    return null;
  }

  const absDays = Math.abs(daysLeft);
  const expiredElapsed =
    daysLeft === 0
      ? t('expiredToday')
      : absDays === 1
      ? t('expiredDayAgo')
      : t('expiredDaysAgo', { count: absDays });
  const dict = {
    banners: {
      activateProposals: {
        title: t('proposalCreationDisabled'),
        subtitle: t('proposalExpiredSubtitle', { expiredElapsed }),
        buttonText: t('reactivateNow'),
      },
    },
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
          <span className="text-2 font-bold text-foreground">
            {dict.banners.activateProposals.title}
          </span>
        </div>
        <span className={cn('text-2', 'text-foreground')}>
          {dict.banners.activateProposals.subtitle}
        </span>
        <Button onClick={handleAction} className="w-fit">
          {dict.banners.activateProposals.buttonText}
        </Button>
      </div>
    </div>
  );
};
