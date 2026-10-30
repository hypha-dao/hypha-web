import { afterEach, describe, expect, it, vi } from 'vitest';
import { stringToHex } from 'viem';

vi.mock('server-only', () => ({}));

const { multicall } = vi.hoisted(() => ({
  multicall: vi.fn(),
}));

vi.mock('../../common/server/web3-rpc/client', () => ({
  web3Client: { multicall, readContract: vi.fn() },
}));

import {
  assembleEnergyCommunitySnapshot,
  decodeEnergySourceId,
  mapEnergySnapshotMemberDetail,
  mapEnergySnapshotOptimization,
  mapEnergySnapshotSource,
} from '../server/community-snapshot-map';
import {
  clearEnergyCommunitySnapshotCache,
  peekEnergyCommunitySnapshot,
  readEnergyCommunitySnapshot,
} from '../server/community-snapshot';

const sourceId = stringToHex('PONTA_SCHOOL_PV', { size: 32 });
const member = '0x1111111111111111111111111111111111111111' as const;

describe('energy community snapshot mapping', () => {
  it('decodes bytes32 source ids and maps sources', () => {
    expect(decodeEnergySourceId(sourceId)).toBe('PONTA_SCHOOL_PV');
    const source = mapEnergySnapshotSource(
      sourceId,
      [0, '0x2222222222222222222222222222222222222222', 10n, true],
      'Ponta do Sol School Solar',
    );
    expect(source).toMatchObject({
      sourceLabel: 'PONTA_SCHOOL_PV',
      sourceDisplayName: 'Ponta do Sol School Solar',
      sourceType: 'SOLAR',
      basePricePerKwh: '10',
      active: true,
    });
  });

  it('maps member balances, meters, and ownership bps', () => {
    const detail = mapEnergySnapshotMemberDetail(member.toUpperCase(), {
      creditBalance: -4n,
      debtStablecoin: 40000n,
      creditStablecoin: 0n,
      ownerships: [[sourceId], [2500n]],
      memberRecord: { deviceIds: [7n, 8n] },
    });

    expect(detail.address).toBe(member);
    expect(detail.energyCreditBalance).toBe('-4');
    expect(detail.debtInStablecoin).toBe('40000');
    expect(detail.deviceIds).toEqual([7, 8]);
    expect(detail.ownershipsOk).toBe(true);
    expect(detail.ownerships).toEqual([
      { sourceId, sourceLabel: 'PONTA_SCHOOL_PV', ownershipBps: 2500 },
    ]);
  });

  it('flags a failed ownership read apart from owning nothing', () => {
    const base = {
      creditBalance: 0n,
      debtStablecoin: 0n,
      creditStablecoin: 0n,
      memberRecord: { deviceIds: [] },
    };
    const failed = mapEnergySnapshotMemberDetail(member, {
      ...base,
      ownerships: null,
    });
    const none = mapEnergySnapshotMemberDetail(member, {
      ...base,
      ownerships: [[], []],
    });

    expect(failed.ownerships).toEqual([]);
    expect(failed.ownershipsOk).toBe(false);
    expect(none.ownerships).toEqual([]);
    expect(none.ownershipsOk).toBe(true);
  });

  it('assembles overview, roles, and optimization from mapped snapshot inputs', () => {
    const snapshot = assembleEnergyCommunitySnapshot({
      communityFeeBps: 500,
      aggregatorFeeBps: 100,
      gridBalance: -12n,
      settledBalance: 3n,
      contractStablecoinBalance: 1800000n,
      zeroSumStatus: [true, 0n],
      memberAddresses: [member],
      sources: [
        mapEnergySnapshotSource(sourceId, [
          1,
          '0x2222222222222222222222222222222222222222',
          15n,
          true,
        ])!,
      ],
      memberDetails: [
        mapEnergySnapshotMemberDetail(member, {
          creditBalance: 2n,
          debtStablecoin: 0n,
          creditStablecoin: 20000n,
          ownerships: null,
          memberRecord: { deviceIds: [7n] },
        }),
      ],
      communityAddress: '0x3333333333333333333333333333333333333333',
      aggregatorAddress: null,
      gridOperator: '0x4444444444444444444444444444444444444444',
      exportDeviceId: 99n,
      optimization: mapEnergySnapshotOptimization(
        [[0, 1, 2], 0, 0n, 0, true],
        [{ wallet: '0x5555555555555555555555555555555555555555', shareBps: 0 }],
      ),
    });

    expect(snapshot.overview).toMatchObject({
      memberCount: 1,
      sourceCount: 1,
      communityFeeBps: 500,
      gridBalance: '-12',
      zeroSumOk: true,
    });
    expect(snapshot.roles.exportDeviceId).toBe('99');
    expect(snapshot.optimization?.purposeRanking).toEqual([
      'SELF_CONSUMPTION',
      'MIN_CO2',
      'LOWEST_PRICE',
    ]);
  });

  it('keeps a failed member roster empty and unmarked', () => {
    const snapshot = assembleEnergyCommunitySnapshot({
      communityFeeBps: null,
      aggregatorFeeBps: null,
      gridBalance: null,
      settledBalance: null,
      contractStablecoinBalance: null,
      zeroSumStatus: null,
      memberAddresses: [],
      memberAddressesOk: false,
      sources: [],
      memberDetails: [],
      communityAddress: null,
      aggregatorAddress: null,
      gridOperator: null,
      exportDeviceId: null,
      optimization: null,
    });

    expect(snapshot.memberAddressesOk).toBe(false);
    expect(snapshot.memberAddresses).toEqual([]);
    expect(snapshot.overview.memberCount).toBe(0);
  });

  it('reloads when getSourceIds fails instead of caching a zero-source snapshot', async () => {
    const community = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
    const viewResults: Record<string, unknown> = {
      getCommunityFeeBps: 0,
      getAggregatorFeeBps: 0,
      getGridBalance: 0n,
      getSettledBalance: 0n,
      getContractStablecoinBalance: 0n,
      verifyZeroSum: [true, 0n],
      getMemberAddresses: [],
      getCommunityAddress: community,
      getAggregatorAddress: community,
      getGridOperator: community,
      getExportDeviceId: 0n,
      getOptimizationConfig: [[], 0, 0n, 0, false],
      getSocialWallets: [],
    };
    let communityReads = 0;
    multicall.mockImplementation(
      async ({
        contracts,
      }: {
        contracts: ReadonlyArray<{ functionName: string }>;
      }) => {
        const isCommunityWave = contracts.some(
          (contract) => contract.functionName === 'getSourceIds',
        );
        if (isCommunityWave) communityReads += 1;
        return contracts.map((contract) => {
          if (contract.functionName === 'getSourceIds') {
            return communityReads === 1
              ? { status: 'failure' }
              : { status: 'success', result: [sourceId] };
          }
          if (contract.functionName === 'getSource') {
            return {
              status: 'success',
              result: [
                0,
                '0x2222222222222222222222222222222222222222',
                10n,
                true,
              ],
            };
          }
          if (contract.functionName === 'name') {
            return { status: 'success', result: 'School PV' };
          }
          return {
            status: 'success',
            result: viewResults[contract.functionName],
          };
        });
      },
    );

    clearEnergyCommunitySnapshotCache();
    const first = await readEnergyCommunitySnapshot(community);
    expect(first.sourcesOk).toBe(false);
    expect(first.overview.sourceCount).toBe(0);
    expect(peekEnergyCommunitySnapshot(community)).toBeUndefined();

    const second = await readEnergyCommunitySnapshot(community);
    expect(second.sourcesOk).toBe(true);
    expect(second.overview.sourceCount).toBeGreaterThan(0);
    expect(second.sources.length).toBeGreaterThan(0);
    expect(second.sources.map((source) => source.sourceLabel)).toEqual([
      'PONTA_SCHOOL_PV',
    ]);
  });

  it('does not cache snapshots with failed fee, member or ownership reads, but tolerates missing optimization', async () => {
    const community = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const;
    const viewResults: Record<string, unknown> = {
      getCommunityFeeBps: 0,
      getAggregatorFeeBps: 0,
      getGridBalance: 0n,
      getSettledBalance: 0n,
      getContractStablecoinBalance: 0n,
      verifyZeroSum: [true, 0n],
      getSourceIds: [],
      getMemberAddresses: [member],
      getCommunityAddress: community,
      getAggregatorAddress: community,
      getGridOperator: community,
      getExportDeviceId: 0n,
      getEnergyCreditBalance: 0n,
      getDebtInStablecoin: 0n,
      getCreditInStablecoin: 0n,
      getAllSourceOwnerships: [[], []],
      getMember: {
        memberAddress: member,
        deviceIds: [7n],
        isActive: true,
        metadataHash: `0x${'0'.repeat(64)}`,
      },
    };
    const failing = new Set(['getCommunityFeeBps', 'getDebtInStablecoin']);
    multicall.mockImplementation(
      async ({
        contracts,
      }: {
        contracts: ReadonlyArray<{ functionName: string }>;
      }) =>
        contracts.map(({ functionName }) =>
          failing.has(functionName) || !(functionName in viewResults)
            ? { status: 'failure' }
            : { status: 'success', result: viewResults[functionName] },
        ),
    );

    clearEnergyCommunitySnapshotCache();
    const partial = await readEnergyCommunitySnapshot(community);
    expect(partial.detailsOk).toBe(false);
    expect(partial.overview.communityFeeBps).toBeNull();
    expect(peekEnergyCommunitySnapshot(community)).toBeUndefined();

    failing.delete('getCommunityFeeBps');
    await readEnergyCommunitySnapshot(community);
    expect(peekEnergyCommunitySnapshot(community)).toBeUndefined();

    failing.clear();
    failing.add('getAllSourceOwnerships');
    const ownershipFailed = await readEnergyCommunitySnapshot(community);
    expect(ownershipFailed.detailsOk).toBe(false);
    expect(ownershipFailed.memberDetails[0]?.ownershipsOk).toBe(false);
    expect(peekEnergyCommunitySnapshot(community)).toBeUndefined();

    failing.clear();
    const complete = await readEnergyCommunitySnapshot(community);
    expect(complete.optimization).toBeNull();
    expect(complete.detailsOk).toBe(true);
    expect(peekEnergyCommunitySnapshot(community)).toBeDefined();
  });
});

afterEach(() => {
  multicall.mockReset();
  clearEnergyCommunitySnapshotCache();
});
