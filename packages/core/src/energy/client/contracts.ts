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
          // Optimization strategy (REC Level 1 base purposes + Level 2 social)
          { name: 'purposeRanking', type: 'uint8[3]' },
          { name: 'socialMode', type: 'uint8' },
          { name: 'socialFixedKwh', type: 'uint256' },
          { name: 'socialVariableBps', type: 'uint16' },
          { name: 'socialWallets', type: 'address[]' },
          { name: 'socialWalletShares', type: 'uint16[]' },
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
 * REC Level 1 base purposes (primary optimisation objectives). The index of
 * each value matches the on-chain `EnergyPPAv2.BasePurpose` enum.
 */
export const ENERGY_BASE_PURPOSES = [
  'SELF_CONSUMPTION',
  'MIN_CO2',
  'LOWEST_PRICE',
] as const;
export type EnergyBasePurpose = (typeof ENERGY_BASE_PURPOSES)[number];

/**
 * REC Level 2 social allocation modes. The index of each value matches the
 * on-chain `EnergyPPAv2.SocialMode` enum.
 */
export const ENERGY_SOCIAL_MODES = ['NONE', 'FIXED', 'VARIABLE'] as const;
export type EnergySocialMode = (typeof ENERGY_SOCIAL_MODES)[number];

export type EnergyPurposeRanking = readonly [
  EnergyBasePurpose,
  EnergyBasePurpose,
  EnergyBasePurpose,
];

const toBasePurposeEnum = (value: EnergyBasePurpose | string): number => {
  const index = ENERGY_BASE_PURPOSES.indexOf(value as EnergyBasePurpose);
  if (index === -1) {
    throw new Error(`Unsupported base purpose: ${value}`);
  }
  return index;
};

const toSocialModeEnum = (value: EnergySocialMode | string): number => {
  const index = ENERGY_SOCIAL_MODES.indexOf(value as EnergySocialMode);
  if (index === -1) {
    throw new Error(`Unsupported social mode: ${value}`);
  }
  return index;
};

const toPurposeRankingEnum = (
  ranking: EnergyPurposeRanking,
): [number, number, number] => {
  const mapped = ranking.map(toBasePurposeEnum) as [number, number, number];
  if (
    mapped[0] === mapped[1] ||
    mapped[1] === mapped[2] ||
    mapped[0] === mapped[2]
  ) {
    throw new Error('Purpose ranking must be a permutation of all three');
  }
  return mapped;
};

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
  // Optimization strategy (REC Level 1 base purposes + Level 2 social)
  purposeRanking: EnergyPurposeRanking;
  socialMode?: EnergySocialMode;
  socialFixedKwh?: string | bigint | number;
  socialVariableBps?: string | number;
  socialWallets?: ReadonlyArray<string>;
  socialWalletShares?: ReadonlyArray<string | number>;
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
 * Scale applied to ownership BPS when minting source tokens (18 decimals).
 * Form sends 1% as 100 BPS → mint 100 * 10^18 wei → UI shows 100 tokens.
 */
const ENERGY_OWNERSHIP_TOKEN_MINT_SCALE = 10n ** 18n;

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
      // Form ownership % is BPS (1% = 100, 100% = 10000). Ownership tokens use
      // 18 decimals — scale so 1% mints 100 whole tokens (100 * 10^18 wei).
      const holderAmounts = source.holderAmounts.map(
        (a) => toBigInt(a) * ENERGY_OWNERSHIP_TOKEN_MINT_SCALE,
      );
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
    purposeRanking: toPurposeRankingEnum(input.purposeRanking),
    socialMode: toSocialModeEnum(input.socialMode ?? 'NONE'),
    socialFixedKwh: toBigInt(input.socialFixedKwh),
    socialVariableBps: toFee(input.socialVariableBps),
    socialWallets: (input.socialWallets ?? []).map((w) => toAddress(w)),
    socialWalletShares: (input.socialWalletShares ?? []).map((s) => toFee(s)),
  };

  if (params.socialWallets.length !== params.socialWalletShares.length) {
    throw new Error('Social wallets and shares length mismatch');
  }

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
    name: 'getMember',
    stateMutability: 'view',
    inputs: [{ name: 'memberAddress', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'memberAddress', type: 'address' },
          { name: 'deviceIds', type: 'uint256[]' },
          { name: 'isActive', type: 'bool' },
          { name: 'metadataHash', type: 'bytes32' },
        ],
      },
    ],
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
  {
    type: 'function',
    name: 'setOptimizationConfig',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'ranking', type: 'uint8[3]' },
      { name: 'mode', type: 'uint8' },
      { name: 'fixedKwh', type: 'uint256' },
      { name: 'variableBps', type: 'uint16' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setSocialWallets',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'wallets', type: 'address[]' },
      { name: 'shareBps', type: 'uint16[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'updateWhitelist',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'isWhitelisted', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getOptimizationConfig',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'ranking', type: 'uint8[3]' },
      { name: 'mode', type: 'uint8' },
      { name: 'fixedKwh', type: 'uint256' },
      { name: 'variableBps', type: 'uint16' },
      { name: 'configured', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'getSocialWallets',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'wallet', type: 'address' },
          { name: 'shareBps', type: 'uint16' },
        ],
      },
    ],
  },
] as const satisfies Abi;

/**
 * Input for the "Change Optimization Strategy" proposal. Targets an existing
 * community proxy (not the factory) and sets the REC base-purpose ranking +
 * social allocation. Executed by the space executor (the proxy owner) when the
 * proposal passes.
 */
export type EnergyOptimizationInput = {
  proxy: string;
  purposeRanking: EnergyPurposeRanking;
  socialMode?: EnergySocialMode;
  socialFixedKwh?: string | bigint | number;
  socialVariableBps?: string | number;
  socialWallets?: ReadonlyArray<string>;
  socialWalletShares?: ReadonlyArray<string | number>;
};

/**
 * Build the calldata for `setOptimizationConfig` (and `setSocialWallets`) on a
 * community proxy. Returns one or two `{ target, value, data }` transactions
 * suitable for a DAO proposal `transactions[]` (executed by the space
 * executor, which owns the proxy after deploy).
 */
export const buildSetOptimizationTransactions = (
  input: EnergyOptimizationInput,
): Array<{ target: `0x${string}`; value: bigint; data: `0x${string}` }> => {
  const proxy = toAddress(input.proxy);
  if (proxy === ZERO_ADDRESS) {
    throw new Error('Community proxy address is required');
  }

  const ranking = toPurposeRankingEnum(input.purposeRanking);
  const wallets = (input.socialWallets ?? []).map((w) => toAddress(w));
  const shares = (input.socialWalletShares ?? []).map((s) => toFee(s));
  if (wallets.length !== shares.length) {
    throw new Error('Social wallets and shares length mismatch');
  }

  const configData = encodeFunctionData({
    abi: energyPpaV2Abi,
    functionName: 'setOptimizationConfig',
    args: [
      ranking,
      toSocialModeEnum(input.socialMode ?? 'NONE'),
      toBigInt(input.socialFixedKwh),
      toFee(input.socialVariableBps),
    ],
  });

  const walletData = encodeFunctionData({
    abi: energyPpaV2Abi,
    functionName: 'setSocialWallets',
    args: [wallets, shares],
  });

  return [
    { target: proxy, value: 0n, data: configData },
    { target: proxy, value: 0n, data: walletData },
  ];
};

export type EnergyUpdateWhitelistInput = {
  proxy: string;
  account: string;
  whitelisted?: boolean;
};

/**
 * Build calldata for `updateWhitelist` on a community proxy. Executed by the
 * space executor (proxy owner) when the proposal passes.
 */
export const buildUpdateWhitelistTransaction = (
  input: EnergyUpdateWhitelistInput,
): { target: `0x${string}`; value: bigint; data: `0x${string}` } => {
  const proxy = toAddress(input.proxy);
  const account = toAddress(input.account);
  if (proxy === ZERO_ADDRESS) {
    throw new Error('Community proxy address is required');
  }
  if (account === ZERO_ADDRESS) {
    throw new Error('Settlement address is required');
  }

  const data = encodeFunctionData({
    abi: energyPpaV2Abi,
    functionName: 'updateWhitelist',
    args: [account, input.whitelisted !== false],
  });

  return { target: proxy, value: 0n, data };
};

/**
 * Base mainnet — Energy PPA v2 reads and sync use this chain only.
 * Intentionally not driven by `NEXT_PUBLIC_GOVERNANCE_CHAIN_ID` / factory env vars
 * so server RPC (`web3Client` on Base) always matches discovery.
 */
export const ENERGY_PPA_CHAIN_ID = 8453 as const satisfies GovernanceChainId;

/**
 * EnergyPPAv2Factory on {@link ENERGY_PPA_CHAIN_ID}.
 * Keep in sync with deployed infra (see `packages/storage-evm/addresses.json`).
 *
 * This factory includes the optimization-strategy fields in `CommunityParams`
 * (`purposeRanking`, social allocation). Deployed 2026-06-16 alongside
 * EnergyPPAv2 implementation `0x70729e412f192AFaD21e2acDCA16D126Eb62b8eF`.
 */
export const energyPpaV2FactoryAddress: Record<
  GovernanceChainId,
  `0x${string}`
> = {
  8453: '0x5F07320B3C95C6fB0A0D77d707F14aC95A897E90',
} as const;

export function getEnergyPpaFactoryAddress(): `0x${string}` {
  return energyPpaV2FactoryAddress[ENERGY_PPA_CHAIN_ID];
}
