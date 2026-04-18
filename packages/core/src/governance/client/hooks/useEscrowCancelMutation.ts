'use client';

import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { publicClient } from '@hypha-platform/core/client';
import {
  escrowImplementationAbi,
  getEscrowImplementationAddress,
} from '../escrow';

export type EscrowCancelInput = {
  escrowId: bigint;
  /**
   * When true, also call `withdrawFromCancelled` in the same batch so the
   * caller's previously-deposited funds are returned in a single user
   * operation. Used by the "Refund" action on the treasury / profile
   * transactions list — `cancelEscrow` alone leaves the funds locked in the
   * escrow until someone explicitly withdraws.
   */
  withdrawAfterCancel?: boolean;
};

/**
 * Cancels an open escrow on behalf of any of its parties. When
 * `withdrawAfterCancel` is true the caller's deposited funds are also
 * withdrawn in the same batched user operation.
 *
 * `cancelEscrow` itself is callable by partyA, partyB, or the creator —
 * matching the on-chain `EscrowImplementation.cancelEscrow` ACL. We do not
 * pre-check funded state here because the contract enforces it.
 */
export const useEscrowCancelMutation = () => {
  const { client } = useSmartWallets();

  const {
    trigger: cancelEscrow,
    reset: resetCancelEscrow,
    isMutating: isCancellingEscrow,
    data: cancelEscrowHash,
    error: cancelEscrowError,
  } = useSWRMutation(
    'escrowCancel',
    async (_, { arg }: { arg: EscrowCancelInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }
      const escrowAddress = getEscrowImplementationAddress();
      if (!escrowAddress) {
        throw new Error('HYPHA_ESCROW_ADDRESS_MISSING');
      }

      // If the caller did not deposit, withdraw would revert ("No funds to
      // withdraw"). Probe the escrow first to decide whether the second leg
      // is even safe to attempt.
      const userAddress = client.account?.address as `0x${string}` | undefined;
      let canWithdraw = false;
      if (arg.withdrawAfterCancel && userAddress) {
        try {
          const raw = (await publicClient.readContract({
            address: escrowAddress,
            abi: escrowImplementationAbi,
            functionName: 'getEscrow',
            args: [arg.escrowId],
          })) as readonly unknown[];
          const partyA = (raw[1] as string)?.toLowerCase?.();
          const partyB = (raw[2] as string)?.toLowerCase?.();
          const isPartyAFunded = raw[7] as boolean;
          const isPartyBFunded = raw[8] as boolean;
          const userLc = userAddress.toLowerCase();
          canWithdraw =
            (partyA === userLc && isPartyAFunded) ||
            (partyB === userLc && isPartyBFunded);
        } catch {
          canWithdraw = false;
        }
      }

      const cancelHash = await client.writeContract({
        address: escrowAddress,
        abi: escrowImplementationAbi,
        functionName: 'cancelEscrow',
        args: [arg.escrowId],
      });
      await publicClient.waitForTransactionReceipt({ hash: cancelHash });

      if (!canWithdraw) {
        return cancelHash;
      }

      const withdrawHash = await client.writeContract({
        address: escrowAddress,
        abi: escrowImplementationAbi,
        functionName: 'withdrawFromCancelled',
        args: [arg.escrowId],
      });
      await publicClient.waitForTransactionReceipt({ hash: withdrawHash });
      return withdrawHash;
    },
  );

  return {
    cancelEscrow,
    resetCancelEscrow,
    isCancellingEscrow,
    cancelEscrowHash,
    cancelEscrowError,
  };
};
