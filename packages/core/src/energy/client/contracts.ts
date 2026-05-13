import type { Abi } from 'viem';
import type { GovernanceChainId } from '../../governance/client/governance-chain-id';

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
    name: 'getEnergyTokenAddress',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getCommunityAddress',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getAggregatorAddress',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getGridOperator',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getExportDeviceId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
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
 * Base mainnet — Energy PPA v2 reads and sync use this chain only.
 * Intentionally not driven by `NEXT_PUBLIC_GOVERNANCE_CHAIN_ID` / factory env vars
 * so server RPC (`web3Client` on Base) always matches discovery.
 */
export const ENERGY_PPA_CHAIN_ID = 8453 as const satisfies GovernanceChainId;

/**
 * EnergyPPAv2Factory on {@link ENERGY_PPA_CHAIN_ID}.
 * Keep in sync with deployed infra (see `packages/storage-evm` demo state).
 */
export const energyPpaV2FactoryAddress: Record<
  GovernanceChainId,
  `0x${string}`
> = {
  8453: '0xB8e042Bc361d1D44Cfe408667B63fAe7E10B90ef',
} as const;

export function getEnergyPpaFactoryAddress(): `0x${string}` {
  return energyPpaV2FactoryAddress[ENERGY_PPA_CHAIN_ID];
}
