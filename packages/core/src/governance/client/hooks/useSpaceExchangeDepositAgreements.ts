'use client';

import useSWR from 'swr';

import { findExchangeDepositEscrowIdsBySpaceIdAction } from '@hypha-platform/core/governance/server/actions';

/**
 * Fetches the set of escrow ids that already have an "Exchange-Deposit"
 * web2 agreement linked to a given space. The space-page deposit banner
 * uses this to hide escrows that already have a pending deposit proposal
 * — preventing duplicate submissions.
 */
export const useSpaceExchangeDepositAgreements = (
  spaceDbId: number | null | undefined,
) => {
  const { data, isLoading, mutate } = useSWR(
    typeof spaceDbId === 'number'
      ? ['spaceExchangeDepositAgreements', spaceDbId]
      : null,
    async ([, id]) => {
      return findExchangeDepositEscrowIdsBySpaceIdAction(id as number);
    },
    { revalidateOnFocus: true, revalidateOnReconnect: true },
  );

  return {
    /** Set of escrow ids (as decimal strings) with an open Exchange-Deposit agreement. */
    escrowIds: data ?? [],
    isLoading,
    refresh: mutate,
  };
};
