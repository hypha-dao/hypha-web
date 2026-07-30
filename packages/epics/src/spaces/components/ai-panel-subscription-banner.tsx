'use client';

import { useSpaceBySlug } from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { usePathname, useRouter } from 'next/navigation';
import React from 'react';
import { useTranslations } from 'next-intl';

import { useSalesBanner } from '../hooks/use-sales-banner';
import { cleanPath } from '../utils/cleanPath';

const PATH_SELECT_ACTIVATE_ACTION = '/select-activate-action';

interface AiPanelSubscriptionBannerProps {
  spaceSlug: string;
  className?: string;
}

export function AiPanelSubscriptionBanner({
  spaceSlug,
  className,
}: AiPanelSubscriptionBannerProps) {
  const { space, isLoading: isSpaceLoading } = useSpaceBySlug(spaceSlug);
  const {
    status,
    daysLeft,
    isLoading: isStatusLoading,
  } = useSalesBanner({
    spaceId: space?.web3SpaceId ?? undefined,
  });
  const tSpaces = useTranslations('Spaces');
  const tAi = useTranslations('AiPanel');
  const pathname = usePathname();
  const router = useRouter();

  const handleExpiredAction = React.useCallback(() => {
    router.push(`${cleanPath(pathname)}${PATH_SELECT_ACTIVATE_ACTION}`);
  }, [router, pathname]);

  if (isSpaceLoading || !space || isStatusLoading || status !== 'expired') {
    return null;
  }

  const absDays = Math.abs(daysLeft);
  const expiredElapsed =
    daysLeft === 0
      ? tSpaces('expiredToday')
      : absDays === 1
      ? tSpaces('expiredDayAgo')
      : tSpaces('expiredDaysAgo', { count: absDays });

  return (
    <div
      className={cn(
        'border-1 rounded-[8px] bg-center border-accent-6 bg-[color-mix(in_oklab,var(--color-accent-surface)_90%,var(--color-accent-9)_10%)]',
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-5">
        <span className="text-2 font-bold text-foreground">
          {tSpaces('proposalCreationDisabled')}
        </span>
        <span className="text-2 text-foreground">
          {tAi('assistantExpiredSubtitle', { expiredElapsed })}
        </span>
        <Button
          onClick={handleExpiredAction}
          variant="outline"
          colorVariant="accent"
          className="space-accent-outline w-fit"
        >
          {tSpaces('reactivateNow')}
        </Button>
      </div>
    </div>
  );
}
