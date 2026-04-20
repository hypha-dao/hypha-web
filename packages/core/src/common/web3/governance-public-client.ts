import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

import { getGovernanceChainId } from '../../governance/client/governance-chain-id';

/**
 * Public client for reading governance txs (same chain as `getGovernanceChainId()`).
 * Prefer this over the legacy `public-client` singleton for receipt waits.
 */
export function createGovernancePublicClient() {
  const chainId = getGovernanceChainId();
  if (chainId !== base.id) {
    throw new Error(
      `Governance chain ${chainId} is not mapped for viem receipts; add chain config to createGovernancePublicClient.`,
    );
  }
  return createPublicClient({
    chain: base,
    transport: process.env.NEXT_PUBLIC_RPC_URL
      ? http(process.env.NEXT_PUBLIC_RPC_URL)
      : http(),
  });
}
