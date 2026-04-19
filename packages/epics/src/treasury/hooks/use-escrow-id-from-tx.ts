'use client';

import useSWR from 'swr';
import { parseEventLogs } from 'viem';
import {
  escrowImplementationAbi,
  publicClient,
} from '@hypha-platform/core/client';

const ESCROW_EVENT_NAMES = [
  'EscrowCreated',
  'EscrowCompleted',
  'EscrowCancelled',
  'FundsWithdrawn',
] as const;

/**
 * Resolve the escrow id for an on-chain transaction by parsing escrow events
 * from its receipt. Returns the FIRST id found across the four lifecycle
 * events (Created / Completed / Cancelled / FundsWithdrawn) — sufficient for
 * the treasury list which only needs to label the counterparty as
 * "Escrow Account (#N)".
 *
 * Returns `undefined` while loading or when the tx had no escrow event (e.g.
 * a plain ERC-20 transfer that happened to involve the escrow address as a
 * relay).
 */
export const useEscrowIdFromTx = (
  hash: string | null | undefined,
): { escrowId?: bigint; isLoading: boolean } => {
  const key = hash ? `escrow-id-from-tx:${hash}` : null;
  const { data, isLoading } = useSWR(
    key,
    async () => {
      if (!hash) return undefined;
      try {
        const receipt = await publicClient.getTransactionReceipt({
          hash: hash as `0x${string}`,
        });
        for (const eventName of ESCROW_EVENT_NAMES) {
          const events = parseEventLogs({
            abi: escrowImplementationAbi,
            logs: receipt.logs,
            eventName,
          });
          const first = events[0];
          const escrowId = first?.args?.escrowId as bigint | undefined;
          if (typeof escrowId === 'bigint') return escrowId;
        }
        return undefined;
      } catch (err) {
        // Receipt unavailable (e.g. tx purged from RPC, network) — fall back
        // to undefined so the UI keeps the unsuffixed label.
        console.warn('useEscrowIdFromTx: failed to read receipt', hash, err);
        return undefined;
      }
    },
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5 * 60 * 1000,
    },
  );

  return { escrowId: data, isLoading };
};
