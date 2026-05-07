import { createPublicClient, fallback, http } from 'viem';
import type { Chain } from 'viem/chains';
import { base } from 'viem/chains';

import { getGovernanceChainId } from '../../governance/client/governance-chain-id';

const governanceChains: Record<number, Chain> = {
  [base.id]: base,
};

/**
 * Public client for reading governance txs (same chain as `getGovernanceChainId()`).
 * Prefer this over the legacy `public-client` singleton for receipt waits.
 */
export function createGovernancePublicClient() {
  const chainId = getGovernanceChainId();
  const chain = governanceChains[chainId];
  if (!chain) {
    throw new Error(
      `Governance chain ${chainId} is not mapped for viem receipts; add chain config to createGovernancePublicClient.`,
    );
  }
  return createPublicClient({
    chain,
    transport: process.env.NEXT_PUBLIC_RPC_URL
      ? fallback([
          http(process.env.NEXT_PUBLIC_RPC_URL),
          http('https://mainnet.base.org'),
        ])
      : http('https://mainnet.base.org'),
  });
}
