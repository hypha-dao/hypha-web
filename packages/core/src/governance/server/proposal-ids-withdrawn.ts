import 'server-only';

import { daoProposalsImplementationConfig } from '@hypha-platform/core/generated';

import { createGovernancePublicClient } from '../../common/web3/governance-public-client';
import { getGovernanceChainId } from '../client/governance-chain-id';

const IS_PROPOSAL_WITHDRAWN_ABI = [
  {
    type: 'function',
    name: 'isProposalWithdrawn',
    stateMutability: 'view',
    inputs: [{ name: '_proposalId', internalType: 'uint256', type: 'uint256' }],
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
  },
] as const;

/**
 * On-chain proposal ids the creator (or owner) withdrew.
 * getProposalCore still looks open for these (0% tallies, future end time),
 * so list UIs must drop them the same way Agreements uses
 * getWithdrawnProposalsBySpace. A failed read returns an empty set so rows
 * stay visible rather than disappearing when RPC is down.
 */
export async function proposalIdsWithdrawn(
  proposalIds: number[],
): Promise<Set<number>> {
  const ids = [...new Set(proposalIds)].filter(
    (id) => Number.isInteger(id) && id > 0,
  );
  if (ids.length === 0) return new Set();
  const chainId = getGovernanceChainId();
  const contract = daoProposalsImplementationConfig.address[chainId];
  if (!contract) return new Set();
  const client = createGovernancePublicClient();
  const results = await client.multicall({
    allowFailure: true,
    contracts: ids.map((id) => ({
      address: contract,
      abi: IS_PROPOSAL_WITHDRAWN_ABI,
      functionName: 'isProposalWithdrawn' as const,
      args: [BigInt(id)] as const,
    })),
  });
  const withdrawn = new Set<number>();
  results.forEach((result, index) => {
    if (result.status === 'success' && result.result === true) {
      const id = ids[index];
      if (id != null) withdrawn.add(id);
    }
  });
  return withdrawn;
}
