'use client';

import { useSpacePayments } from './use-space-payments';
import { useHasSpacePaid } from './use-has-space-paid';
import { useState, useEffect } from 'react';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

interface UseSalesBannerProps {
  spaceId?: number;
}

export const useSalesBanner = ({ spaceId }: UseSalesBannerProps) => {
  const { payments, isLoading } = useSpacePayments(
    canConvertToBigInt(spaceId)
      ? { spaceId: BigInt(spaceId) }
      : { spaceId: undefined as never },
  );
  const { hasSpacePaid } = useHasSpacePaid(
    canConvertToBigInt(spaceId)
      ? { spaceId: BigInt(spaceId) }
      : { spaceId: undefined as never },
  );

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

  let status: 'trial' | 'beforeExpiry' | 'expired' | null = null;
  if (isLoading || !payments || !freeTrialUsed) {
    status = null;
  } else if (!hasSpacePaid && freeTrialUsed && daysLeft > 0) {
    status = 'trial';
  } else if (hasSpacePaid && daysLeft > 0 && daysLeft <= 14) {
    status = 'beforeExpiry';
  } else if (daysLeft <= 0) {
    status = 'expired';
  }

  const storageKey = spaceId ? `salesBannerDismissedUntil_${spaceId}` : null;

  const [dismissedUntil, setDismissedUntil] = useState<number>(() => {
    if (typeof window === 'undefined' || !storageKey) return 0;
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved ? parseInt(saved, 10) : 0;
    } catch (err) {
      console.error('Error reading from localStorage:', err);
      return 0;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !storageKey) return;
    try {
      if (dismissedUntil > 0) {
        window.localStorage.setItem(storageKey, dismissedUntil.toString());
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch (err) {
      console.error('Error writing to localStorage:', err);
    }
  }, [dismissedUntil, storageKey]);

  const shouldHideDueToDismiss = dismissedUntil > Date.now();

  if (shouldHideDueToDismiss) {
    status = null;
  }

  const onClose = () => {
    setDismissedUntil(Date.now() + 24 * 60 * 60 * 1000);
  };

  return { status, daysLeft, onClose, isLoading };
};
