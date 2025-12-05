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

interface SubscriptionBadgeProps extends Omit<BadgeProps, 'isLoading'> {
  web3SpaceId: number;
}

const PATH_SELECT_ACTIVATE_ACTION = '/select-activate-action';

export function SubscriptionBadge({
  web3SpaceId,
  className,
  ...props
}: SubscriptionBadgeProps) {
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
    ? 'Please sign in to use this feature.'
    : !isMember && !isDelegate
    ? 'Please join this space to use this feature.'
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
    return date.toLocaleDateString('en-US', {
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
    label = `Active on free trial until ${formatDate(expiryTime)}`;
  } else if (hasSpacePaid && daysLeft > 0 && daysLeft <= 14) {
    status = 'activate';
    label = `Renew before ${formatDate(expiryTime)}`;
  } else if (hasSpacePaid && daysLeft > 0) {
    status = 'active';
    label = `Active until ${formatDate(expiryTime)}`;
  } else if (daysLeft <= 0 && expiryTime > 0) {
    status = 'expired';
    label = `Expired since ${formatDate(expiryTime)}`;
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
        colorVariant={variantMap[status].colorVariant}
        className={className}
        {...props}
      >
        {label}
      </Badge>
    </Link>
  );
}
