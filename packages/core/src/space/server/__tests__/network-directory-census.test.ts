import { describe, expect, it } from 'vitest';
import { isSpaceArchived } from '../../utils';
import { attachNetworkCensusCounts } from '../network-directory-census';

const address = (suffix: string) =>
  `0x${suffix.padStart(40, '0')}` as `0x${string}`;

describe('attachNetworkCensusCounts', () => {
  const spaces = [
    { id: 1, web3SpaceId: 10 },
    { id: 2, web3SpaceId: 20 },
    { id: 3, web3SpaceId: null },
    { id: 4, web3SpaceId: 40 },
  ];

  it('archives spaces with no members and counts accepted agreements', () => {
    const attached = attachNetworkCensusCounts(
      spaces,
      new Map([
        [10, [address('aa'), address('bb')]],
        [20, []],
      ]),
      new Map([
        [10, 4],
        [20, 0],
        [40, 2],
      ]),
    );

    expect(attached[0]).toMatchObject({
      memberCount: 2,
      memberAddresses: [address('aa'), address('bb')],
      documentCount: 4,
    });
    expect(attached[1]).toMatchObject({ memberCount: 0, documentCount: 0 });
    expect(attached[1]).not.toHaveProperty('memberAddresses');
    expect(isSpaceArchived(attached[1]!)).toBe(true);
    expect(attached[2]).toMatchObject({ memberCount: 0 });
    expect(isSpaceArchived(attached[2]!)).toBe(true);
    expect(attached[3]).toMatchObject({ documentCount: 2 });
    expect(attached[3]).not.toHaveProperty('memberCount');
    expect(isSpaceArchived(attached[3]!)).toBe(false);
  });
});
