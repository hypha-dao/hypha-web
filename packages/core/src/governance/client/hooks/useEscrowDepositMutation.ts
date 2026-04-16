'use client';

import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { erc20Abi } from 'viem';
import { publicClient } from '@hypha-platform/core/client';
import {
  escrowImplementationAbi,
  getEscrowImplementationAddress,
} from '../escrow';

export type EscrowDepositInput = {
  escrowId: bigint;
  /** Token the user deposits (escrow tokenB). */
  token: `0x${string}`;
  /** Amount in raw token units (already scaled by tokenB decimals). */
  amount: bigint;
  /** Current allowance so we can skip approve when it already covers amount. */
  currentAllowance: bigint;
};

/**
 * Approves the escrow to pull `amount` of tokenB if not already approved, then calls
 * `receiveFunds(escrowId)` which completes the exchange atomically when party A has
 * already funded tokenA.
 */
export const useEscrowDepositMutation = () => {
  const { client } = useSmartWallets();

  const {
    trigger: deposit,
    reset: resetDeposit,
    isMutating: isDepositing,
    data: depositHash,
    error: depositError,
  } = useSWRMutation(
    'escrowDeposit',
    async (_, { arg }: { arg: EscrowDepositInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const escrowAddress = getEscrowImplementationAddress();
      if (!escrowAddress) {
        throw new Error('HYPHA_ESCROW_ADDRESS_MISSING');
      }

      if (arg.currentAllowance < arg.amount) {
        const approveHash = await client.writeContract({
          address: arg.token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [escrowAddress, arg.amount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      const txHash = await client.writeContract({
        address: escrowAddress,
        abi: escrowImplementationAbi,
        functionName: 'receiveFunds',
        args: [arg.escrowId],
      });

      return txHash;
    },
  );

  return {
    deposit,
    resetDeposit,
    isDepositing,
    depositHash,
    depositError,
  };
};
