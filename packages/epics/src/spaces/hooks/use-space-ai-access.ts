'use client';

import { canConvertToBigInt } from '@hypha-platform/ui-utils';

import { useSpacePayments } from './use-space-payments';

interface UseSpaceAiAccessProps {
  spaceId?: number;
}

/** Whether Hypha AI chat is allowed for a space (active free trial or paid contribution). */
export function useSpaceAiAccess({ spaceId }: UseSpaceAiAccessProps) {
  const hasWeb3Id = canConvertToBigInt(spaceId);
  const { payments, isLoading } = useSpacePayments(
    hasWeb3Id ? { spaceId: BigInt(spaceId) } : { spaceId: undefined as never },
  );

  let expiryTime = BigInt(0);
  if (payments) {
    [expiryTime] = payments;
  }

  const daysLeft = expiryTime
    ? Math.ceil(
        (Number(expiryTime) * 1000 - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : 0;

  const hadContribution = expiryTime > BigInt(0);
  const canUseAi = Boolean(payments) && daysLeft > 0;
  const isExpired = Boolean(payments) && hadContribution && daysLeft <= 0;
  const needsActivation = Boolean(payments) && !hadContribution;

  return {
    canUseAi,
    isExpired,
    needsActivation,
    daysLeft,
    isLoading: !hasWeb3Id ? false : isLoading || !payments,
  };
}
