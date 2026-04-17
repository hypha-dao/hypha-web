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

      // If a previous attempt actually landed on-chain (even when the UI
      // surfaced an error, e.g. a retried simulation), the user's side of this
      // escrow may already be funded. Calling `receiveFunds` again reverts with
      // "Party already funded or invalid state". Detect and short-circuit.
      const userAddress = client.account?.address as `0x${string}` | undefined;
      if (userAddress) {
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
          const isCompleted = raw[9] as boolean;
          const isCancelled = raw[10] as boolean;
          const userLc = userAddress.toLowerCase();
          const alreadyFunded =
            isCompleted ||
            isCancelled ||
            (partyA === userLc && isPartyAFunded) ||
            (partyB === userLc && isPartyBFunded);
          if (alreadyFunded) {
            // Hash = null signals "already settled, nothing to submit". The
            // banner will refresh its pending-deposits list and disappear.
            return null;
          }
        } catch {
          // If the precheck fails for any reason, fall through and let the
          // actual transaction attempt surface the error.
        }
      }

      if (arg.currentAllowance < arg.amount) {
        const approveHash = await client.writeContract({
          address: arg.token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [escrowAddress, arg.amount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });

        /**
         * Smart wallet / bundler flows can race here: `waitForTransactionReceipt`
         * returns as soon as the approve tx is included, but the bundler's
         * simulation for the next userOp may still see pre-approve state and
         * revert with `ERC20InsufficientAllowance` (selector `0xfb8f41b2`).
         *
         * Poll the live allowance until it catches up to the required amount
         * before submitting `receiveFunds`. Mirrors the
         * `waitForSufficientAllowance` pattern used by `useBuySpaceTokensMutation`.
         */
        if (userAddress) {
          const maxAttempts = 45;
          const delayMs = 1000;
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const live = await publicClient.readContract({
              address: arg.token,
              abi: erc20Abi,
              functionName: 'allowance',
              args: [userAddress, escrowAddress],
            });
            if (live >= arg.amount) break;
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
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
