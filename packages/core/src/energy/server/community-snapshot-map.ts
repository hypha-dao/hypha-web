import { hexToString } from 'viem';

export const ENERGY_SOURCE_TYPES: Record<number, string> = {
  0: 'SOLAR',
  1: 'BATTERY',
};

export const ENERGY_BASE_PURPOSE_LABELS = [
  'SELF_CONSUMPTION',
  'MIN_CO2',
  'LOWEST_PRICE',
] as const;

export const ENERGY_SOCIAL_MODE_LABELS = ['NONE', 'FIXED', 'VARIABLE'] as const;

export type EnergySnapshotSource = {
  sourceId: `0x${string}`;
  sourceLabel: string;
  sourceDisplayName: string;
  sourceType: string;
  ownershipToken: `0x${string}`;
  basePricePerKwh: string;
  active: boolean;
};

export type EnergySnapshotMemberDetail = {
  address: `0x${string}`;
  energyCreditBalance: string | null;
  debtInStablecoin: string | null;
  creditInStablecoin: string | null;
  deviceIds: number[] | null;
  ownerships: {
    sourceId: `0x${string}`;
    sourceLabel: string;
    ownershipBps: number;
  }[];
};

export type EnergySnapshotOptimization = {
  configured: boolean;
  purposeRanking: string[];
  socialMode: string;
  socialFixedKwh: string;
  socialVariableBps: number;
  socialWallets: { wallet: `0x${string}`; shareBps: number }[];
};

export type EnergyCommunityOnChainSnapshot = {
  memberAddresses: `0x${string}`[];
  /** False when `getMemberAddresses` failed — do not seed the 30s roster cache. */
  memberAddressesOk: boolean;
  /** False when `getSourceIds` failed — do not cache a zero-source snapshot. */
  sourcesOk: boolean;
  memberDetails: EnergySnapshotMemberDetail[];
  sources: EnergySnapshotSource[];
  overview: {
    memberCount: number;
    sourceCount: number;
    communityFeeBps: number | null;
    aggregatorFeeBps: number | null;
    gridBalance: string | null;
    settledBalance: string | null;
    contractStablecoinBalance: string | null;
    zeroSumOk: boolean | null;
    zeroSumDelta: string | null;
  };
  roles: {
    communityAddress: `0x${string}` | null;
    aggregatorAddress: `0x${string}` | null;
    gridOperator: `0x${string}` | null;
    exportDeviceId: string | null;
  };
  optimization: EnergySnapshotOptimization | null;
};

export const decodeEnergySourceId = (value: `0x${string}`) => {
  try {
    const parsed = hexToString(value, { size: 32 })
      .replace(/\u0000/g, '')
      .trim();
    return parsed.length > 0 ? parsed : value;
  } catch {
    return value;
  }
};

const toLowerAddress = (value: `0x${string}` | string | null | undefined) => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return null;
  return normalized as `0x${string}`;
};

const bigintToString = (value: bigint | null | undefined) =>
  value === null || value === undefined ? null : value.toString();

export function mapEnergySnapshotSource(
  sourceId: `0x${string}`,
  value: readonly [number, `0x${string}`, bigint, boolean] | null,
  tokenName?: string,
): EnergySnapshotSource | null {
  if (!value) return null;
  const ownershipToken = value[1];
  const decodedId = decodeEnergySourceId(sourceId);
  return {
    sourceId,
    sourceLabel: decodedId,
    sourceDisplayName: tokenName ?? decodedId,
    sourceType: ENERGY_SOURCE_TYPES[Number(value[0])] ?? 'UNKNOWN',
    ownershipToken,
    basePricePerKwh: value[2].toString(),
    active: value[3],
  };
}

export function mapEnergySnapshotMemberDetail(
  rawAddress: `0x${string}` | string,
  input: {
    creditBalance: bigint | null;
    debtStablecoin: bigint | null;
    creditStablecoin: bigint | null;
    ownerships: readonly [readonly `0x${string}`[], readonly bigint[]] | null;
    memberRecord: { deviceIds: readonly bigint[] } | null;
  },
): EnergySnapshotMemberDetail {
  const address = rawAddress.toLowerCase() as `0x${string}`;
  const ownedIds = input.ownerships ? input.ownerships[0] : [];
  const ownedBps = input.ownerships ? input.ownerships[1] : [];
  return {
    address,
    energyCreditBalance: bigintToString(input.creditBalance),
    debtInStablecoin: bigintToString(input.debtStablecoin),
    creditInStablecoin: bigintToString(input.creditStablecoin),
    deviceIds: input.memberRecord
      ? input.memberRecord.deviceIds.map((id) => Number(id))
      : null,
    ownerships: ownedIds.map((sourceId, index) => ({
      sourceId,
      sourceLabel: decodeEnergySourceId(sourceId),
      ownershipBps: Number(ownedBps[index] ?? 0n),
    })),
  };
}

export function mapEnergySnapshotOptimization(
  optimizationConfig:
    | readonly [readonly number[], number, bigint, number, boolean]
    | null,
  socialWalletsRaw:
    | readonly { wallet: `0x${string}`; shareBps: number }[]
    | null,
): EnergySnapshotOptimization | null {
  if (!optimizationConfig) return null;
  return {
    configured: optimizationConfig[4],
    purposeRanking: optimizationConfig[0].map(
      (purpose) =>
        ENERGY_BASE_PURPOSE_LABELS[Number(purpose)] ?? `UNKNOWN(${purpose})`,
    ),
    socialMode:
      ENERGY_SOCIAL_MODE_LABELS[Number(optimizationConfig[1])] ?? 'NONE',
    socialFixedKwh: optimizationConfig[2].toString(),
    socialVariableBps: Number(optimizationConfig[3]),
    socialWallets: (socialWalletsRaw ?? []).map((wallet) => ({
      wallet: wallet.wallet.toLowerCase() as `0x${string}`,
      shareBps: Number(wallet.shareBps),
    })),
  };
}

export function assembleEnergyCommunitySnapshot(input: {
  communityFeeBps: number | null;
  aggregatorFeeBps: number | null;
  gridBalance: bigint | null;
  settledBalance: bigint | null;
  contractStablecoinBalance: bigint | null;
  zeroSumStatus: readonly [boolean, bigint] | null;
  memberAddresses: readonly `0x${string}`[];
  memberAddressesOk?: boolean;
  sourcesOk?: boolean;
  sourceCount?: number;
  sources: EnergySnapshotSource[];
  memberDetails: EnergySnapshotMemberDetail[];
  communityAddress: `0x${string}` | null;
  aggregatorAddress: `0x${string}` | null;
  gridOperator: `0x${string}` | null;
  exportDeviceId: bigint | null;
  optimization: EnergySnapshotOptimization | null;
}): EnergyCommunityOnChainSnapshot {
  const memberAddresses = input.memberAddresses.map(
    (address) => address.toLowerCase() as `0x${string}`,
  );
  return {
    memberAddresses,
    memberAddressesOk: input.memberAddressesOk ?? true,
    sourcesOk: input.sourcesOk ?? true,
    memberDetails: input.memberDetails,
    sources: input.sources,
    overview: {
      memberCount: memberAddresses.length,
      sourceCount: input.sourceCount ?? input.sources.length,
      communityFeeBps:
        input.communityFeeBps !== null ? Number(input.communityFeeBps) : null,
      aggregatorFeeBps:
        input.aggregatorFeeBps !== null ? Number(input.aggregatorFeeBps) : null,
      gridBalance: bigintToString(input.gridBalance),
      settledBalance: bigintToString(input.settledBalance),
      contractStablecoinBalance: bigintToString(
        input.contractStablecoinBalance,
      ),
      zeroSumOk: input.zeroSumStatus ? input.zeroSumStatus[0] : null,
      zeroSumDelta: input.zeroSumStatus
        ? input.zeroSumStatus[1].toString()
        : null,
    },
    roles: {
      communityAddress: toLowerAddress(input.communityAddress),
      aggregatorAddress: toLowerAddress(input.aggregatorAddress),
      gridOperator: toLowerAddress(input.gridOperator),
      exportDeviceId:
        input.exportDeviceId !== null ? input.exportDeviceId.toString() : null,
    },
    optimization: input.optimization,
  };
}
