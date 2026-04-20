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
import { cn } from '@hypha-platform/ui-utils';
import { useIsDelegate } from '@hypha-platform/core/client';
import { useFormatter, useTranslations } from 'next-intl';

interface SubscriptionBadgeProps extends Omit<BadgeProps, 'isLoading'> {
  web3SpaceId: number;
  /** High-contrast pill for dark scrims (e.g. space hero) — avoids pale outline hover fills */
  forDarkBackground?: boolean;
}

const PATH_SELECT_ACTIVATE_ACTION = '/select-activate-action';

const darkHeroOutlineByTone = {
  success:
    'border-emerald-400/55 bg-black/35 text-emerald-50 shadow-none hover:border-emerald-300/75 hover:bg-emerald-950/55 focus-visible:ring-emerald-400/35',
  warn: 'border-amber-400/55 bg-black/35 text-amber-50 shadow-none hover:border-amber-300/75 hover:bg-amber-950/45 focus-visible:ring-amber-400/35',
  error:
    'border-red-400/55 bg-black/35 text-red-50 shadow-none hover:border-red-300/75 hover:bg-red-950/45 focus-visible:ring-red-400/35',
} as const satisfies Record<
  Extract<
    NonNullable<BadgeProps['colorVariant']>,
    'success' | 'warn' | 'error'
  >,
  string
>;

export function SubscriptionBadge({
  web3SpaceId,
  className,
  forDarkBackground = false,
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

  const tone = variantMap[status].colorVariant;
  const darkModeclasses =
    forDarkBackground &&
    tone &&
    tone in darkHeroOutlineByTone &&
    darkHeroOutlineByTone[tone as keyof typeof darkHeroOutlineByTone];

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
        colorVariant={tone}
        className={cn(darkModeclasses, className)}
        {...props}
      >
        {label}
      </Badge>
    </Link>
  );
}
