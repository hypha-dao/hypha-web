'use client';

import * as React from 'react';
import { Badge, type BadgeProps } from '@hypha-platform/ui';
import { useSpacePayments } from '../hooks/use-space-payments';
import { cn } from '@hypha-platform/ui-utils';

interface SubscriptionBadgeProps extends Omit<BadgeProps, 'isLoading'> {
  web3SpaceId: number;
}

export function SubscriptionBadge({
  web3SpaceId,
  className,
  ...props
}: SubscriptionBadgeProps) {
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

  let status: 'active' | 'activate' | 'renew' | 'expired' | null = null;
  let label: string = '';

  if (isLoading || !payments || !freeTrialUsed) {
    return null;
  }

  if (freeTrialUsed && daysLeft > 0 && daysLeft <= 30) {
    status = daysLeft <= 14 ? 'activate' : 'active';
    label =
      status === 'active'
        ? `Active until ${formatDate(expiryTime)}`
        : `Activate before ${formatDate(expiryTime)}`;
  } else if (daysLeft > 0 && daysLeft <= 14) {
    status = 'renew';
    label = `Renew before ${formatDate(expiryTime)}`;
  } else if (daysLeft < 0) {
    status = 'expired';
    label = `Expired since ${formatDate(expiryTime)}`;
  } else if (daysLeft > 14) {
    status = 'active';
    label = `Active until ${formatDate(expiryTime)}`;
  }

  if (!status) {
    return null;
  }

  const variantMap: Record<
    NonNullable<typeof status>,
    { colorVariant: BadgeProps['colorVariant'] }
  > = {
    active: { colorVariant: 'success' },
    activate: { colorVariant: 'warn' },
    renew: { colorVariant: 'warn' },
    expired: { colorVariant: 'error' },
  };

  return (
    <Badge
      variant="outline"
      size={1}
      colorVariant={variantMap[status].colorVariant}
      className={cn('ml-3', className)}
      {...props}
    >
      {label}
    </Badge>
  );
}
