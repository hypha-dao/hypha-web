'use client';

import { ChromeBannerShell } from '../../common/chrome-banner';
import { Button } from '@hypha-platform/ui';
import { useSalesBanner, useSpaceMember } from '../hooks';
import { usePathname } from 'next/navigation';
import { cleanPath } from '../utils/cleanPath';
import { useAuthentication } from '@hypha-platform/authentication';
import Link from 'next/link';
import { useIsDelegate } from '@hypha-platform/core/client';
import { CloudLightning, ShieldAlert } from 'lucide-react';
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

  const tone = status === 'expired' ? 'critical' : ('warning' as const);

  const icon =
    status === 'expired' ? (
      <ShieldAlert strokeWidth={2} />
    ) : (
      <CloudLightning strokeWidth={2} />
    );

  return (
    <ChromeBannerShell
      tone={tone}
      icon={icon}
      title={title}
      subtitle={subtitle}
      onDismiss={onClose}
      dismissLabel={tCommon('close')}
      actions={
        <Link
          title={tooltipMessage || ''}
          className={
            isDisabled ? 'cursor-not-allowed inline-flex' : 'inline-flex'
          }
          href={`${cleanPath(pathname)}${PATH_SELECT_ACTIVATE_ACTION}`}
        >
          <Button disabled={isDisabled} size="sm" className="min-h-9 px-4">
            {actionText}
          </Button>
        </Link>
      }
    />
  );
};
