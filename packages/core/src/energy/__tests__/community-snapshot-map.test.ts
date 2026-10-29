import { describe, expect, it } from 'vitest';
import { stringToHex } from 'viem';

import {
  assembleEnergyCommunitySnapshot,
  decodeEnergySourceId,
  mapEnergySnapshotMemberDetail,
  mapEnergySnapshotOptimization,
  mapEnergySnapshotSource,
} from '../server/community-snapshot-map';

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
    expect(detail.ownerships).toEqual([
      { sourceId, sourceLabel: 'PONTA_SCHOOL_PV', ownershipBps: 2500 },
    ]);
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
});
