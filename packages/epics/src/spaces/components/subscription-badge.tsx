'use client';

import * as React from 'react';
import { Badge, type BadgeProps } from '@hypha-platform/ui';
import { useSpacePayments } from '../hooks/use-space-payments';
import { cleanPath } from '../utils/cleanPath';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

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

  let status: 'active' | 'activeFreeTrial' | 'activate' | 'expired' | null =
    null;
  let label: string = '';

  if (isLoading || !payments) {
    return null;
  }

  if (freeTrialUsed && daysLeft > 15 && daysLeft <= 30) {
    status = 'activeFreeTrial';
    label = `Active on free trial until ${formatDate(expiryTime)}`;
  } else if (freeTrialUsed && daysLeft > 0 && daysLeft <= 15) {
    status = 'activate';
    label = `Activate before ${formatDate(expiryTime)}`;
  } else if (daysLeft > 0) {
    status = 'active';
    label = `Active until ${formatDate(expiryTime)}`;
  } else if (!freeTrialUsed && daysLeft <= 0 && expiryTime > 0) {
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
    activate: { colorVariant: 'warn' },
    expired: { colorVariant: 'error' },
  };

  return (
    <Link href={`${cleanPath(pathname)}${PATH_SELECT_ACTIVATE_ACTION}`}>
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
