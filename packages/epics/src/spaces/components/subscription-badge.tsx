'use client';

import * as React from 'react';
import { Badge, type BadgeProps } from '@hypha-platform/ui';
import { useHasSpacePaid } from '../hooks';
import { useSpacePayments } from '../hooks/use-space-payments';
import { cleanPath } from '../utils/cleanPath';
import { usePathname } from 'next/navigation';
import { useSpaceMember } from '../hooks';
import { useAuthentication } from '@hypha-platform/authentication';
import Link from 'next/link';
import { useIsDelegate } from '@hypha-platform/core/client';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

interface SubscriptionBadgeProps extends Omit<BadgeProps, 'isLoading'> {
  web3SpaceId: number;
  /**
   * When true, use a single high-contrast border + text tuned for dark hero
   * banners (avoids stacking `colorVariant` outline with forced accent borders).
   */
  onHeroBackground?: boolean;
}

const PATH_SELECT_ACTIVATE_ACTION = '/select-activate-action';

export function SubscriptionBadge({
  web3SpaceId,
  className,
  onHeroBackground = false,
  ...props
}: SubscriptionBadgeProps) {
  const tCommon = useTranslations('Common');
  const tSpaces = useTranslations('Spaces');
  const format = useFormatter();
  const pathname = usePathname();
  const { payments, isLoading } = useSpacePayments({
    spaceId: BigInt(web3SpaceId),
  });
  const { hasSpacePaid } = useHasSpacePaid({
    spaceId: BigInt(web3SpaceId),
  });
  const { isMember } = useSpaceMember({ spaceId: web3SpaceId as number });
  const { isDelegate } = useIsDelegate({ spaceId: web3SpaceId as number });
  const { isAuthenticated } = useAuthentication();

  const isDisabled = !isAuthenticated || (!isMember && !isDelegate);
  const tooltipMessage = !isAuthenticated
    ? tCommon('signIn')
    : !isMember && !isDelegate
    ? tCommon('joinSpaceToUse')
    : '';

  let expiryTime: bigint = BigInt(0);
  let freeTrialUsed: boolean = false;

  if (payments) {
    [expiryTime, freeTrialUsed] = payments;
  }

  const daysLeft = expiryTime
    ? Math.ceil(
        (Number(expiryTime) * 1000 - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : 0;

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return format.dateTime(date, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  let status:
    | 'active'
    | 'activeFreeTrial'
    | 'activate'
    | 'expired'
    | 'activeFreeTrialExpiring'
    | null = null;
  let label: string = '';

  if (isLoading || !payments) {
    return null;
  }

  if (!hasSpacePaid && freeTrialUsed && daysLeft > 0) {
    status = daysLeft <= 14 ? 'activeFreeTrialExpiring' : 'activeFreeTrial';
    label = tSpaces('subscriptionBadgeActiveFreeTrialUntil', {
      date: formatDate(expiryTime),
    });
  } else if (hasSpacePaid && daysLeft > 0 && daysLeft <= 14) {
    status = 'activate';
    label = tSpaces('subscriptionBadgeRenewBefore', {
      date: formatDate(expiryTime),
    });
  } else if (hasSpacePaid && daysLeft > 0) {
    status = 'active';
    label = tSpaces('subscriptionBadgeActiveUntil', {
      date: formatDate(expiryTime),
    });
  } else if (daysLeft <= 0 && expiryTime > 0) {
    status = 'expired';
    label = tSpaces('subscriptionBadgeExpiredSince', {
      date: formatDate(expiryTime),
    });
  }

  if (!status) {
    return null;
  }

  const variantMap: Record<
    NonNullable<typeof status>,
    { colorVariant: BadgeProps['colorVariant'] }
  > = {
    active: { colorVariant: 'success' },
    activeFreeTrial: { colorVariant: 'success' },
    activeFreeTrialExpiring: { colorVariant: 'warn' },
    activate: { colorVariant: 'warn' },
    expired: { colorVariant: 'error' },
  };

  /** Single readable border on dark hero; `!` beats outline compound tokens */
  const heroBannerClassByStatus: Record<NonNullable<typeof status>, string> = {
    active:
      'bg-black/25 shadow-sm !ring-0 hover:!ring-0 !border-emerald-400/85 !text-emerald-50 hover:!border-emerald-300/90 hover:bg-black/35 hover:!text-white',
    activeFreeTrial:
      'bg-black/25 shadow-sm !ring-0 hover:!ring-0 !border-emerald-400/85 !text-emerald-50 hover:!border-emerald-300/90 hover:bg-black/35 hover:!text-white',
    activeFreeTrialExpiring:
      'bg-black/25 shadow-sm !ring-0 hover:!ring-0 !border-amber-400/90 !text-amber-50 hover:!border-amber-300/90 hover:bg-black/35 hover:!text-amber-50',
    activate:
      'bg-black/25 shadow-sm !ring-0 hover:!ring-0 !border-amber-400/90 !text-amber-50 hover:!border-amber-300/90 hover:bg-black/35 hover:!text-amber-50',
    expired:
      'bg-black/25 shadow-sm !ring-0 hover:!ring-0 !border-red-400/90 !text-red-50 hover:!border-red-300/90 hover:bg-black/35 hover:!text-red-50',
  };

  const { colorVariant } = variantMap[status];

  return (
    <Link
      className={isDisabled ? 'cursor-not-allowed' : ''}
      title={tooltipMessage || ''}
      href={
        isDisabled ? {} : `${cleanPath(pathname)}${PATH_SELECT_ACTIVATE_ACTION}`
      }
    >
      <Badge
        variant="outline"
        size={1}
        colorVariant={colorVariant}
        className={cn(
          onHeroBackground && heroBannerClassByStatus[status],
          className,
        )}
        {...props}
      >
        {label}
      </Badge>
    </Link>
  );
}
