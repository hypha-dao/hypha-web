import type { Abi } from 'viem';
import { getGovernanceChainId } from '../../governance/client/governance-chain-id';
import type { GovernanceChainId } from '../../governance/client/governance-chain-id';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export const energyPpaV2FactoryAbi = [
  {
    type: 'function',
    name: 'getAdminCommunities',
    stateMutability: 'view',
    inputs: [{ name: 'admin', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    type: 'function',
    name: 'communities',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'proxy', type: 'address' },
      { name: 'energyToken', type: 'address' },
      { name: 'admin', type: 'address' },
      { name: 'deployedAt', type: 'uint256' },
    ],
  },
] as const satisfies Abi;

export const energyPpaV2Abi = [
  {
    type: 'function',
    name: 'getCommunityFeeBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'getAggregatorFeeBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'getGridBalance',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'int256' }],
  },
  {
    type: 'function',
    name: 'getSettledBalance',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'int256' }],
  },
  {
    type: 'function',
    name: 'getContractStablecoinBalance',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'verifyZeroSum',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: '', type: 'bool' },
      { name: '', type: 'int256' },
    ],
  },
  {
    type: 'function',
    name: 'getSourceIds',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32[]' }],
  },
  {
    type: 'function',
    name: 'getSource',
    stateMutability: 'view',
    inputs: [{ name: 'sourceId', type: 'bytes32' }],
    outputs: [
      { name: 'sourceType', type: 'uint8' },
      { name: 'ownershipToken', type: 'address' },
      { name: 'basePricePerKwh', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'getMemberAddresses',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getEnergyCreditBalance',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'int256' }],
  },
  {
    type: 'function',
    name: 'getDebtInStablecoin',
    stateMutability: 'view',
    inputs: [{ name: 'debtor', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getCreditInStablecoin',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getAllSourceOwnerships',
    stateMutability: 'view',
    inputs: [{ name: 'member', type: 'address' }],
    outputs: [
      { name: 'ids', type: 'bytes32[]' },
      { name: 'bps', type: 'uint256[]' },
    ],
  },
  {
    type: 'function',
    name: 'settleOwnDebt',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'stablecoinAmount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claimCredit',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'internalAmount', type: 'uint256' }],
    outputs: [],
  },
] as const satisfies Abi;

/**
 * EnergyPPAv2Factory addresses by governance chain.
 * Keep this in sync with deployed infra similarly to other generated address maps.
 */
export const energyPpaV2FactoryAddress: Record<
  GovernanceChainId,
  `0x${string}`
> = {
  8453: '0xB8e042Bc361d1D44Cfe408667B63fAe7E10B90ef',
} as const;

export function getEnergyPpaFactoryAddress(): `0x${string}` | undefined {
  if (typeof process === 'undefined') return undefined;

  // Optional runtime override for emergency rollouts / local testing.
  const explicit = process.env.NEXT_PUBLIC_ENERGY_PPA_FACTORY_ADDRESS?.trim();
  if (explicit) {
    if (ADDRESS_RE.test(explicit)) return explicit as `0x${string}`;
    return undefined;
  }

  const chainId = getGovernanceChainId();
  const chainScoped =
    process.env[`NEXT_PUBLIC_ENERGY_PPA_FACTORY_ADDRESS_${chainId}`]?.trim();
  if (chainScoped && ADDRESS_RE.test(chainScoped)) {
    return chainScoped as `0x${string}`;
  }

  const chainId = getGovernanceChainId();
  return energyPpaV2FactoryAddress[chainId];
}
