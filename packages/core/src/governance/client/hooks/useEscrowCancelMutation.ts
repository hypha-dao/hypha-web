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
   * When true, also call `withdrawFromCancelled` in the same flow so the
   * caller's previously-deposited funds are returned. Used by the "Refund"
   * action on the treasury / profile transactions list — `cancelEscrow`
   * alone leaves the funds locked in the escrow until someone explicitly
   * withdraws.
   */
  withdrawAfterCancel?: boolean;
};

type EscrowState = {
  partyA: string;
  partyB: string;
  isPartyAFunded: boolean;
  isPartyBFunded: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
};

const readEscrowState = async (
  escrowAddress: `0x${string}`,
  escrowId: bigint,
): Promise<EscrowState | null> => {
  try {
    const raw = (await publicClient.readContract({
      address: escrowAddress,
      abi: escrowImplementationAbi,
      functionName: 'getEscrow',
      args: [escrowId],
    })) as readonly unknown[];
    return {
      partyA: ((raw[1] as string) ?? '').toLowerCase(),
      partyB: ((raw[2] as string) ?? '').toLowerCase(),
      isPartyAFunded: raw[7] as boolean,
      isPartyBFunded: raw[8] as boolean,
      isCompleted: raw[9] as boolean,
      isCancelled: raw[10] as boolean,
    };
  } catch {
    return null;
  }
};

const userCanWithdraw = (state: EscrowState | null, userLc: string): boolean =>
  !!state &&
  ((state.partyA === userLc && state.isPartyAFunded) ||
    (state.partyB === userLc && state.isPartyBFunded));

/**
 * True when the bundler/RPC says the userOp would revert because the escrow
 * is already in the desired terminal cancelled state — a no-op race we want
 * to swallow so the user gets a "Refund" success rather than a scary red
 * stack trace.
 */
const isAlreadyCancelledRevert = (err: unknown): boolean => {
  const msg =
    err instanceof Error ? `${err.message} ${err.stack ?? ''}` : String(err);
  return (
    /Escrow already cancelled/i.test(msg) ||
    /Escrow already completed/i.test(msg) ||
    // ASCII-hex of the revert strings, present in raw bundler responses.
    /457363726f7720616c72656164792063616e63656c6c6564/i.test(msg) ||
    /457363726f7720616c726561647920636f6d706c65746564/i.test(msg)
  );
};

/**
 * True when `withdrawFromCancelled` reverts because the bundler is still
 * looking at pre-cancel state — the cancel tx has already been mined on our
 * RPC but the bundler's simulation node is a few blocks behind. We poll &
 * retry instead of surfacing this as an error.
 */
const isNotCancelledYetRevert = (err: unknown): boolean => {
  const msg =
    err instanceof Error ? `${err.message} ${err.stack ?? ''}` : String(err);
  return (
    /Escrow not cancelled/i.test(msg) ||
    /457363726f77206e6f742063616e63656c6c6564/i.test(msg)
  );
};

const isNoFundsRevert = (err: unknown): boolean => {
  const msg =
    err instanceof Error ? `${err.message} ${err.stack ?? ''}` : String(err);
  return (
    /No funds to withdraw/i.test(msg) ||
    /4e6f2066756e647320746f2077697468647261/i.test(msg)
  );
};

/**
 * Cancels an open escrow on behalf of any of its parties. When
 * `withdrawAfterCancel` is true the caller's deposited funds are also
 * withdrawn after the cancel.
 *
 * The mutation is idempotent and resilient to RPC propagation lag:
 *   - If the escrow is already cancelled, the cancel step is skipped.
 *   - If the cancel step reverts with "already cancelled", we treat it as
 *     success and continue.
 *   - Before submitting the withdraw, we poll the live escrow state until
 *     `isCancelled === true` so the bundler's simulation does not race
 *     against post-cancel state.
 *   - If the withdraw still reverts with "Escrow not cancelled" we wait a
 *     little longer and retry once.
 *   - If the withdraw reverts with "No funds to withdraw" (a previous
 *     attempt already pulled the funds back) we treat it as success.
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

      const userAddress = client.account?.address as `0x${string}` | undefined;
      const userLc = userAddress?.toLowerCase() ?? '';

      let state = await readEscrowState(escrowAddress, arg.escrowId);

      // Already-completed escrows can no longer be cancelled or withdrawn
      // from. Surface as a soft success — the caller's intent ("get my
      // money back / make the banner go away") is moot.
      if (state?.isCompleted) {
        return null;
      }

      let lastHash: `0x${string}` | null = null;

      if (!state?.isCancelled) {
        try {
          const cancelHash = await client.writeContract({
            address: escrowAddress,
            abi: escrowImplementationAbi,
            functionName: 'cancelEscrow',
            args: [arg.escrowId],
          });
          await publicClient.waitForTransactionReceipt({ hash: cancelHash });
          lastHash = cancelHash;
        } catch (err) {
          if (!isAlreadyCancelledRevert(err)) {
            throw err;
          }
          // Race: the escrow flipped to cancelled between our pre-read and
          // the bundler simulation. Continue with the withdraw step.
        }
      }

      if (!arg.withdrawAfterCancel || !userAddress) {
        return lastHash;
      }

      // Wait for `isCancelled === true` on a "latest" read before we ask
      // the bundler to simulate `withdrawFromCancelled`. Without this gate
      // the bundler's RPC node may still be a block behind ours and the
      // userOp simulation reverts with "Escrow not cancelled".
      const waitMs = 500;
      const maxWaitAttempts = 20; // ≈10s
      for (let attempt = 0; attempt < maxWaitAttempts; attempt++) {
        state = await readEscrowState(escrowAddress, arg.escrowId);
        if (state?.isCancelled) break;
        await new Promise((r) => setTimeout(r, waitMs));
      }

      if (!state || !state.isCancelled) {
        // Cancel was submitted (or pre-read said cancelled) yet our RPC
        // still doesn't see it. Falling through to withdraw would just
        // revert; surface the existing cancel hash so the caller can
        // refresh and retry rather than reporting a misleading error.
        return lastHash;
      }

      if (!userCanWithdraw(state, userLc)) {
        // The user's funds are already back (a previous attempt's
        // withdraw landed on chain even if the UI thought it failed) or
        // the user never funded their side. Either way, nothing to do.
        return lastHash;
      }

      const tryWithdraw = async (): Promise<`0x${string}`> =>
        client.writeContract({
          address: escrowAddress,
          abi: escrowImplementationAbi,
          functionName: 'withdrawFromCancelled',
          args: [arg.escrowId],
        });

      try {
        const withdrawHash = await tryWithdraw();
        await publicClient.waitForTransactionReceipt({ hash: withdrawHash });
        return withdrawHash;
      } catch (err) {
        if (isNoFundsRevert(err)) {
          // Funds already returned — soft success.
          return lastHash;
        }
        if (!isNotCancelledYetRevert(err)) {
          throw err;
        }

        // Bundler still racing post-cancel state. Wait longer and retry
        // exactly once before giving up; further retries are unlikely to
        // help and we don't want to spin indefinitely on the user's gas.
        for (let attempt = 0; attempt < maxWaitAttempts; attempt++) {
          state = await readEscrowState(escrowAddress, arg.escrowId);
          if (state?.isCancelled) break;
          await new Promise((r) => setTimeout(r, waitMs));
        }

        try {
          const withdrawHash = await tryWithdraw();
          await publicClient.waitForTransactionReceipt({ hash: withdrawHash });
          return withdrawHash;
        } catch (retryErr) {
          if (isNoFundsRevert(retryErr)) {
            return lastHash;
          }
          throw retryErr;
        }
      }
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
