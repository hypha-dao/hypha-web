import type { GovernanceChainId } from './governance-chain-id';
import { getEscrowImplementationAddress } from '../escrow';

/**
 * Legacy/static map of known exchange escrow contracts per chain. Prefer
 * {@link getEscrowImplementationAddress} which respects env overrides and the
 * generated address map from `packages/core/src/generated`.
 *
 * Kept exported so existing UI code that imports it keeps compiling.
 */
export const EXCHANGE_ESCROW_CONTRACT_BY_CHAIN: Partial<
  Record<GovernanceChainId, `0x${string}`>
> = {};

export const isExchangeEscrowContractAddress = (address?: string): boolean => {
  if (!address) return false;
  const lower = address.toLowerCase();
  const dynamic = getEscrowImplementationAddress();
  if (dynamic && dynamic.toLowerCase() === lower) return true;
  return Object.values(EXCHANGE_ESCROW_CONTRACT_BY_CHAIN).some(
    (a) => a && a.toLowerCase() === lower,
  );
};
