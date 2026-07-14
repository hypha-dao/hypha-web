import { Contract, type Provider } from 'ethers';
import type { OnChainConfig, SourceInfo, MemberInfo } from './types';

const ENERGY_PPA_ABI = [
  'function getSourceIds() view returns (bytes32[])',
  'function getSource(bytes32) view returns (tuple(uint8 sourceType, address ownershipToken, uint256 basePricePerKwh, bool active))',
  'function getMemberAddresses() view returns (address[])',
  'function getMember(address) view returns (tuple(address memberAddress, uint256[] deviceIds, bool isActive, bytes32 metadataHash))',
  'function getExportDeviceId() view returns (uint256)',
  'function getCommunityFeeBps() view returns (uint16)',
  'function getAggregatorFeeBps() view returns (uint16)',
  'function getDeviceOwner(uint256) view returns (address)',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
];

const SOURCE_TYPE_MAP: Record<number, 'SOLAR' | 'BATTERY'> = {
  0: 'SOLAR',
  1: 'BATTERY',
};

/**
 * Read the full community configuration from a deployed EnergyPPAv2 contract.
 *
 * This is a read-only operation: it snapshots source registry, member list,
 * and ownership token balances into a single OnChainConfig object that the
 * fair-split algorithm consumes.
 */
export async function readOnChainConfig(
  provider: Provider,
  contractAddress: string,
): Promise<OnChainConfig> {
  const ppa = new Contract(contractAddress, ENERGY_PPA_ABI, provider);

  const [
    sourceIds,
    memberAddresses,
    exportDeviceIdBn,
    communityFeeBps,
    aggregatorFeeBps,
  ] = await Promise.all([
    ppa.getSourceIds() as Promise<string[]>,
    ppa.getMemberAddresses() as Promise<string[]>,
    ppa.getExportDeviceId() as Promise<bigint>,
    ppa.getCommunityFeeBps() as Promise<number>,
    ppa.getAggregatorFeeBps() as Promise<number>,
  ]);

  const exportDeviceId = Number(exportDeviceIdBn);

  const members: MemberInfo[] = await Promise.all(
    memberAddresses.map(async (addr) => {
      const m = await ppa.getMember(addr);
      return {
        address: m.memberAddress as string,
        deviceIds: (m.deviceIds as bigint[]).map(Number),
        isActive: m.isActive as boolean,
      };
    }),
  );

  const deviceToMember = new Map<number, string>();
  for (const member of members) {
    for (const deviceId of member.deviceIds) {
      deviceToMember.set(deviceId, member.address);
    }
  }

  const sources: SourceInfo[] = await Promise.all(
    sourceIds.map(async (sourceId) => {
      const src = await ppa.getSource(sourceId);
      const ownershipToken = src.ownershipToken as string;
      const ownershipBps = await readOwnershipBps(
        provider,
        ownershipToken,
        memberAddresses,
      );
      return {
        sourceId,
        sourceType: SOURCE_TYPE_MAP[Number(src.sourceType)] ?? 'SOLAR',
        basePricePerKwh: src.basePricePerKwh as bigint,
        ownershipToken,
        ownershipBps,
      };
    }),
  );

  return {
    contractAddress,
    sources,
    members,
    exportDeviceId,
    communityFeeBps: Number(communityFeeBps),
    aggregatorFeeBps: Number(aggregatorFeeBps),
    deviceToMember,
  };
}

/**
 * Read ownership basis points for each member from a source's ERC-20 token.
 * Returns a Map where each member's ownership = balanceOf(member) * 10000 / totalSupply.
 */
async function readOwnershipBps(
  provider: Provider,
  tokenAddress: string,
  memberAddresses: string[],
): Promise<Map<string, number>> {
  const token = new Contract(tokenAddress, ERC20_ABI, provider);
  const totalSupply: bigint = await token.totalSupply();
  if (totalSupply === 0n) return new Map();

  const balances: bigint[] = await Promise.all(
    memberAddresses.map((addr) => token.balanceOf(addr) as Promise<bigint>),
  );

  const ownershipBps = new Map<string, number>();
  for (let i = 0; i < memberAddresses.length; i++) {
    if (balances[i] > 0n) {
      ownershipBps.set(
        memberAddresses[i],
        Number((balances[i] * 10000n) / totalSupply),
      );
    }
  }

  return ownershipBps;
}
