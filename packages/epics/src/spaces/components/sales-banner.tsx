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
    <div className="flex flex-col items-stretch gap-3 rounded-lg border border-border/80 bg-background-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
        <ExclamationTriangleIcon
          width={14}
          height={14}
          className="mt-0.5 shrink-0 text-muted-foreground sm:mt-0"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-2 font-medium leading-snug text-foreground">
            {title}
          </p>
          <p
            className="mt-0.5 line-clamp-1 text-1 font-normal text-muted-foreground"
            title={subtitle}
          >
            {subtitle}
          </p>
        </div>
      </div>
      <div className="relative z-[1] flex shrink-0 items-center justify-end gap-3 overflow-visible">
        <Link
          title={tooltipMessage || subtitle}
          className={isDisabled ? 'cursor-not-allowed shrink-0' : 'shrink-0'}
          href={`${cleanPath(pathname)}${PATH_SELECT_ACTIVATE_ACTION}`}
        >
          <Button
            disabled={isDisabled}
            variant="outline"
            colorVariant="accent"
            size="sm"
            className="space-accent-outline relative min-h-8 shrink-0 px-3 text-xs"
          >
            {actionText}
          </Button>
        </Link>
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="relative z-[1] h-8 w-8 min-h-8 min-w-8 shrink-0 rounded-chrome text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label={tCommon('close')}
        >
          <Cross1Icon className="craft-icon-sm" width={14} height={14} />
        </Button>
      </div>
    </div>
  );
};
