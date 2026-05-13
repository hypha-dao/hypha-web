import type { Abi } from 'viem';
import { encodeFunctionData, keccak256, stringToBytes } from 'viem';
import type { GovernanceChainId } from '../../governance/client/governance-chain-id';

const BYTES32_RE = /^0x[a-fA-F0-9]{64}$/;
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
  {
    type: 'function',
    name: 'deployCommunity',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'p',
        type: 'tuple',
        internalType: 'struct EnergyPPAv2Factory.CommunityParams',
        components: [
          { name: 'admin', type: 'address' },
          { name: 'stablecoin', type: 'address' },
          { name: 'communityAddress', type: 'address' },
          { name: 'aggregatorAddress', type: 'address' },
          { name: 'gridOperator', type: 'address' },
          { name: 'communityFeeBps', type: 'uint16' },
          { name: 'aggregatorFeeBps', type: 'uint16' },
          { name: 'exportDeviceId', type: 'uint256' },
          { name: 'energyTokenName', type: 'string' },
          { name: 'energyTokenSymbol', type: 'string' },
          {
            name: 'sources',
            type: 'tuple[]',
            internalType: 'struct EnergyPPAv2Factory.SourceConfig[]',
            components: [
              { name: 'sourceId', type: 'bytes32' },
              { name: 'sourceType', type: 'uint8' },
              { name: 'tokenName', type: 'string' },
              { name: 'tokenSymbol', type: 'string' },
              { name: 'basePricePerKwh', type: 'uint256' },
              { name: 'holders', type: 'address[]' },
              { name: 'holderAmounts', type: 'uint256[]' },
            ],
          },
          {
            name: 'members',
            type: 'tuple[]',
            internalType: 'struct EnergyPPAv2Factory.MemberConfig[]',
            components: [
              { name: 'memberAddress', type: 'address' },
              { name: 'deviceIds', type: 'uint256[]' },
              { name: 'metadataHash', type: 'bytes32' },
            ],
          },
        ],
      },
    ],
    outputs: [
      { name: 'communityId', type: 'uint256' },
      { name: 'proxy', type: 'address' },
    ],
  },
] as const satisfies Abi;

/**
 * Shape of CommunityParams passed to `EnergyPPAv2Factory.deployCommunity`.
 * Mirrors the Solidity struct (`packages/storage-evm/contracts/EnergyPPAv2Factory.sol`).
 */
export type EnergyDeployCommunitySourceInput = {
  sourceId: string;
  sourceType: 'SOLAR' | 'BATTERY' | string;
  tokenName: string;
  tokenSymbol: string;
  basePricePerKwh: string | bigint | number;
  holders: ReadonlyArray<string>;
  holderAmounts: ReadonlyArray<string | bigint | number>;
};

export type EnergyDeployCommunityMemberInput = {
  memberAddress: string;
  deviceIds: ReadonlyArray<string | bigint | number>;
  metadataHash: string;
};

export type EnergyDeployCommunityInput = {
  admin: string;
  stablecoin: string;
  communityAddress?: string;
  aggregatorAddress?: string;
  gridOperator: string;
  communityFeeBps?: string | number;
  aggregatorFeeBps?: string | number;
  exportDeviceId?: string | bigint | number;
  energyTokenName: string;
  energyTokenSymbol: string;
  sources: ReadonlyArray<EnergyDeployCommunitySourceInput>;
  members?: ReadonlyArray<EnergyDeployCommunityMemberInput>;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

const toAddress = (value: string | undefined | null): `0x${string}` => {
  if (!value) return ZERO_ADDRESS;
  const trimmed = value.trim();
  if (!trimmed) return ZERO_ADDRESS;
  if (!ADDRESS_RE.test(trimmed)) {
    throw new Error(`Invalid address: ${value}`);
  }
  return trimmed as `0x${string}`;
};

const toBytes32 = (value: string | undefined | null): `0x${string}` => {
  if (!value) return ZERO_BYTES32;
  const trimmed = value.trim();
  if (!trimmed) return ZERO_BYTES32;
  if (BYTES32_RE.test(trimmed)) return trimmed as `0x${string}`;
  throw new Error(`Invalid bytes32: ${value}`);
};

const toBigInt = (
  value: string | bigint | number | undefined | null,
): bigint => {
  if (value === undefined || value === null || value === '') return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  const trimmed = value.trim();
  if (!trimmed) return 0n;
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid unsigned integer: ${value}`);
  }
  return BigInt(trimmed);
};

const toFee = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 10000) {
    throw new Error(`Invalid BPS value (0-10000): ${value}`);
  }
  return n;
};

/**
 * Map a UI source identifier to bytes32:
 * - if input is already a 0x-prefixed 32-byte hex, use as-is
 * - otherwise apply `keccak256(utf8Bytes(input))` so identical labels match
 *   the convention used by the on-chain demo (`packages/storage-evm/scripts/...`).
 */
export const encodeEnergySourceId = (sourceId: string): `0x${string}` => {
  const trimmed = sourceId.trim();
  if (!trimmed) {
    throw new Error('Source ID is required');
  }
  if (BYTES32_RE.test(trimmed)) return trimmed as `0x${string}`;
  return keccak256(stringToBytes(trimmed));
};

const SOURCE_TYPE_TO_ENUM: Record<string, number> = {
  SOLAR: 0,
  BATTERY: 1,
};

const toSourceTypeEnum = (value: string): number => {
  const key = value.trim().toUpperCase();
  const enumValue = SOURCE_TYPE_TO_ENUM[key];
  if (enumValue === undefined) {
    throw new Error(`Unsupported source type: ${value}`);
  }
  return enumValue;
};

/**
 * Build the calldata for `EnergyPPAv2Factory.deployCommunity(p)` from form-shaped
 * inputs. Returns `{ target, value, data }` suitable for inclusion in a DAO
 * proposal `transactions[]` (executed by the space executor when the proposal
 * passes).
 *
 * For Hypha discovery to find the resulting community, `admin` MUST be the
 * **space executor** — the address that will be `msg.sender` of the factory
 * call. Callers are responsible for setting it to the executor.
 */
export const buildDeployCommunityTransaction = (
  input: EnergyDeployCommunityInput,
): { target: `0x${string}`; value: bigint; data: `0x${string}` } => {
  const params = {
    admin: toAddress(input.admin),
    stablecoin: toAddress(input.stablecoin),
    communityAddress: toAddress(input.communityAddress),
    aggregatorAddress: toAddress(input.aggregatorAddress),
    gridOperator: toAddress(input.gridOperator),
    communityFeeBps: toFee(input.communityFeeBps),
    aggregatorFeeBps: toFee(input.aggregatorFeeBps),
    exportDeviceId: toBigInt(input.exportDeviceId),
    energyTokenName: input.energyTokenName.trim(),
    energyTokenSymbol: input.energyTokenSymbol.trim(),
    sources: input.sources.map((source) => {
      const holders = source.holders.map((h) => toAddress(h));
      const holderAmounts = source.holderAmounts.map((a) => toBigInt(a));
      if (holders.length !== holderAmounts.length) {
        throw new Error(
          `Source ${source.sourceId}: holders and holderAmounts length mismatch`,
        );
      }
      return {
        sourceId: encodeEnergySourceId(source.sourceId),
        sourceType: toSourceTypeEnum(String(source.sourceType)),
        tokenName: source.tokenName.trim(),
        tokenSymbol: source.tokenSymbol.trim(),
        basePricePerKwh: toBigInt(source.basePricePerKwh),
        holders,
        holderAmounts,
      };
    }),
    members: (input.members ?? []).map((member) => ({
      memberAddress: toAddress(member.memberAddress),
      deviceIds: member.deviceIds.map((id) => toBigInt(id)),
      metadataHash: toBytes32(member.metadataHash),
    })),
  };

  if (params.admin === ZERO_ADDRESS) {
    throw new Error('Admin address is required');
  }
  if (params.sources.length === 0) {
    throw new Error('At least one energy source is required');
  }

  const factory = getEnergyPpaFactoryAddress();
  const data = encodeFunctionData({
    abi: energyPpaV2FactoryAbi,
    functionName: 'deployCommunity',
    args: [params],
  });
  return { target: factory, value: 0n, data };
};

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
