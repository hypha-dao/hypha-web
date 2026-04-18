import type { GovernanceChainId } from './governance-chain-id';

/**
 * Escrow contract that holds exchange funds (same addresses as
 * `useExchangeStakesAndTokensMutationsWeb3Rpc` `escrowAddressByChain`).
 * Used to detect when a party address was mistakenly set to the escrow
 * contract instead of the buyer/seller wallet.
 */
export const EXCHANGE_ESCROW_CONTRACT_BY_CHAIN: Partial<
  Record<GovernanceChainId, `0x${string}`>
> = {
  8453: '0x447A317cA5516933264Cdd6aeee0633Fa954B576',
};

export const isExchangeEscrowContractAddress = (address?: string): boolean => {
  if (!address) return false;
  const lower = address.toLowerCase();
  return Object.values(EXCHANGE_ESCROW_CONTRACT_BY_CHAIN).some(
    (a) => a && a.toLowerCase() === lower,
  );
};
