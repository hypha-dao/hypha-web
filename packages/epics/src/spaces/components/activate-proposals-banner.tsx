'use client';

import { ChromeBannerShell } from '../../common/chrome-banner';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useSalesBanner } from '../hooks';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ShieldAlert } from 'lucide-react';
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

  return (
    <div className={cn('w-full', className)}>
      <ChromeBannerShell
        tone="critical"
        icon={<ShieldAlert strokeWidth={2} />}
        title={t('proposalCreationDisabled')}
        subtitle={t('proposalExpiredSubtitle', { expiredElapsed })}
        actions={
          <Button size="sm" className="min-h-9 px-4" onClick={handleAction}>
            {t('reactivateNow')}
          </Button>
        }
      />
    </div>
  );
};
