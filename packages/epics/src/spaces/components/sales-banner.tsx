'use client';

import { Button } from '@hypha-platform/ui';
import { useSalesBanner, useSpaceMember } from '../hooks';
import { Cross1Icon } from '@radix-ui/react-icons';
import { usePathname } from 'next/navigation';
import { cleanPath } from '../utils/cleanPath';
import { useAuthentication } from '@hypha-platform/authentication';
import Link from 'next/link';
import { useIsDelegate } from '@hypha-platform/core/client';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';

interface BannerState {
  title: string;
  subtitle: string;
  actionText: string;
}

interface SalesBannerProps {
  web3SpaceId?: number;
}

const PATH_SELECT_ACTIVATE_ACTION = '/select-activate-action';

export const SalesBanner = ({ web3SpaceId }: SalesBannerProps) => {
  const t = useTranslations('Spaces');
  const tCommon = useTranslations('Common');
  const pathname = usePathname();
  const { status, daysLeft, onClose, isLoading } = useSalesBanner({
    spaceId: web3SpaceId,
  });
  const { isMember } = useSpaceMember({ spaceId: web3SpaceId as number });
  const { isDelegate } = useIsDelegate({ spaceId: web3SpaceId as number });
  const { isAuthenticated } = useAuthentication();

  if (isLoading || !status) {
    return null;
  }

  const isDisabled = !isAuthenticated || (!isMember && !isDelegate);
  const tooltipMessage = !isAuthenticated
    ? tCommon('signIn')
    : !isMember && !isDelegate
    ? tCommon('joinSpaceToUse')
    : '';

  const bannerStates: Record<
    'trial' | 'beforeExpiry' | 'expired',
    BannerState
  > = {
    trial: {
      title: t('trialBannerTitle', { daysLeft }),
      subtitle: t('trialBannerSubtitle'),
      actionText: t('activateNow'),
    },
    beforeExpiry: {
      title: t('beforeExpiryBannerTitle', { daysLeft }),
      subtitle: t('beforeExpiryBannerSubtitle'),
      actionText: t('renewNow'),
    },
    expired: {
      title: t('expiredBannerTitle', { daysAgo: Math.abs(daysLeft) }),
      subtitle: t('expiredBannerSubtitle'),
      actionText: t('reactivateNow'),
    },
  };

  const { title, subtitle, actionText } = bannerStates[status];

  return (
    <div className="flex flex-col items-stretch justify-between gap-3 rounded-[8px] border-1 border-accent-6 bg-accent-surface bg-center p-3 sm:p-4 md:flex-row md:items-center md:gap-4">
      <div className="flex w-full min-w-0 items-start gap-2.5 sm:gap-3 md:w-auto md:max-w-[min(100%,42rem)]">
        <ExclamationTriangleIcon
          width={16}
          height={16}
          className="mt-0.5 flex-shrink-0 text-foreground"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:gap-1">
          <span className="text-2 font-bold text-foreground">{title}</span>
          <span className="line-clamp-2 text-2 text-foreground sm:line-clamp-none">
            {subtitle}
          </span>
        </div>
      </div>
      <div className="flex w-full justify-between gap-2 md:w-auto md:shrink-0 md:justify-end">
        <Link
          title={tooltipMessage || ''}
          className={
            isDisabled
              ? 'cursor-not-allowed flex-1 md:flex-auto'
              : 'flex-1 md:flex-auto'
          }
          href={`${cleanPath(pathname)}${PATH_SELECT_ACTIVATE_ACTION}`}
        >
          <Button
            disabled={isDisabled}
            className="w-full md:w-fit text-wrap justify-center"
          >
            {actionText}
          </Button>
        </Link>
        <Button
          onClick={onClose}
          variant="ghost"
          className="rounded-full w-fit text-foreground flex-shrink-0"
        >
          <Cross1Icon width={16} height={16} />
        </Button>
      </div>
    </div>
  );
};
