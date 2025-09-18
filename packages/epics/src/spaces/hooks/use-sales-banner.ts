'use client';

import { useSpacePayments } from './use-space-payments';
import { useState, useEffect } from 'react';

interface UseSalesBannerProps {
  spaceId?: number;
}

export const useSalesBanner = ({ spaceId }: UseSalesBannerProps) => {
  const { payments, isLoading } = useSpacePayments(
    spaceId !== undefined
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

  if (isLoading || !payments) {
    status = null;
  } else if (!freeTrialUsed) {
    status = null;
  } else if (freeTrialUsed && daysLeft > 0 && daysLeft <= 30) {
    status = 'trial';
  } else if (daysLeft > 0 && daysLeft <= 14) {
    status = 'beforeExpiry';
  } else if (daysLeft < 0) {
    status = 'expired';
  }

  const storageKey = spaceId ? `salesBannerDismissedUntil_${spaceId}` : null;
  const [dismissedUntil, setDismissedUntil] = useState(() => {
    if (!storageKey) return 0;
    const saved = localStorage.getItem(storageKey);
    return saved ? parseInt(saved, 10) : 0;
  });

  useEffect(() => {
    if (!storageKey) return;
    if (dismissedUntil > 0) {
      localStorage.setItem(storageKey, dismissedUntil.toString());
    } else {
      localStorage.removeItem(storageKey);
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
