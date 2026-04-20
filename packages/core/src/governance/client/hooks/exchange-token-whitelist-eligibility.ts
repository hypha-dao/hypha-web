import { publicClient } from '@hypha-platform/core/client';
import { decayingSpaceTokenAbi } from '@hypha-platform/core/generated';

/**
 * ABI slice for Hypha space tokens (Regular/Decaying) that support transfer/receive
 * whitelists. Plain ERC-20s will fail these reads — callers should treat that as eligible.
 */
const spaceTokenAbi = decayingSpaceTokenAbi;

/**
 * Returns whether the executor can fund escrow with this token under whitelist rules:
 * - If `useTransferWhitelist`: `from` (executor) must pass `canAccountTransfer`
 * - If `useReceiveWhitelist`: `to` (escrow) must pass `canReceive`
 * If neither flag is set, returns true. If reads fail (non–space token), returns true.
 */
export async function canExecutorSendToEscrowForExchange(params: {
  tokenAddress: `0x${string}`;
  executorAddress: `0x${string}`;
  escrowAddress: `0x${string}`;
}): Promise<boolean> {
  const { tokenAddress, executorAddress, escrowAddress } = params;

  try {
    const [useTransferWhitelist, useReceiveWhitelist] = await Promise.all([
      publicClient
        .readContract({
          address: tokenAddress,
          abi: spaceTokenAbi,
          functionName: 'useTransferWhitelist',
        })
        .catch(() => undefined),
      publicClient
        .readContract({
          address: tokenAddress,
          abi: spaceTokenAbi,
          functionName: 'useReceiveWhitelist',
        })
        .catch(() => undefined),
    ]);

    if (
      useTransferWhitelist === undefined &&
      useReceiveWhitelist === undefined
    ) {
      return true;
    }

    if (
      useTransferWhitelist === undefined ||
      useReceiveWhitelist === undefined
    ) {
      console.warn(
        '[canExecutorSendToEscrowForExchange] partial whitelist read; failing closed',
        { tokenAddress, executorAddress, escrowAddress },
      );
      return false;
    }

    if (!useTransferWhitelist && !useReceiveWhitelist) {
      return true;
    }

    if (useTransferWhitelist) {
      const canTransfer = await publicClient
        .readContract({
          address: tokenAddress,
          abi: spaceTokenAbi,
          functionName: 'canAccountTransfer',
          args: [executorAddress],
        })
        .catch(() => false);
      if (!canTransfer) {
        return false;
      }
    }

    if (useReceiveWhitelist) {
      const canRecv = await publicClient
        .readContract({
          address: tokenAddress,
          abi: spaceTokenAbi,
          functionName: 'canReceive',
          args: [escrowAddress],
        })
        .catch(() => false);
      if (!canRecv) {
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error(
      '[canExecutorSendToEscrowForExchange] RPC failure checking whitelist flags',
      { tokenAddress, executorAddress, escrowAddress, err },
    );
    return true;
  }
}

/**
 * Buyer later calls `receiveFunds` as Party B: `transferFrom(buyer, escrow, tokenB)`.
 * Requires `canAccountTransfer(buyer)` when transfer whitelist is on, and
 * `canReceive(escrow)` when receive whitelist is on.
 */
export async function canBuyerSendToEscrowForExchange(params: {
  tokenAddress: `0x${string}`;
  buyerAddress: `0x${string}`;
  escrowAddress: `0x${string}`;
}): Promise<boolean> {
  return canExecutorSendToEscrowForExchange({
    tokenAddress: params.tokenAddress,
    executorAddress: params.buyerAddress,
    escrowAddress: params.escrowAddress,
  });
}
