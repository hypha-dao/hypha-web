import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';

import {
  EPARTS_TOKEN_ADDRESS,
  HYPHA_TOKEN_ADDRESS,
  isEpartsToken,
} from '../../common/web3/tokens';
import {
  extraSharedDistributionTokenAddresses,
  shouldIncludeHyphaEnergyOwnershipToken,
  shouldIncludeHyphaSharedToken,
} from '../distribution-shared-tokens';

describe('shouldIncludeHyphaSharedToken', () => {
  it('matches Hypha-branded slugs and titles', () => {
    expect(
      shouldIncludeHyphaSharedToken({ spaceSlug: 'hypha', spaceTitle: 'X' }),
    ).toBe(true);
    expect(
      shouldIncludeHyphaSharedToken({
        spaceSlug: 'hypha-energy-capital',
        spaceTitle: 'Capital',
      }),
    ).toBe(true);
    expect(
      shouldIncludeHyphaSharedToken({
        spaceSlug: 'other',
        spaceTitle: 'Hypha Energy',
      }),
    ).toBe(true);
  });

  it('does not match unrelated spaces', () => {
    expect(
      shouldIncludeHyphaSharedToken({
        spaceSlug: 'localscale',
        spaceTitle: 'Ponta',
      }),
    ).toBe(false);
  });
});

describe('shouldIncludeHyphaEnergyOwnershipToken', () => {
  it('matches Hypha Energy and its named spaces, including Capital BV and GA', () => {
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'hypha-energy',
        spaceTitle: 'Hypha Energy',
      }),
    ).toBe(true);
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'hypha-energy-capital',
        spaceTitle: 'Hypha Energy Capital BV',
      }),
    ).toBe(true);
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'hypha-energy-general-assembly',
        spaceTitle: 'Hypha Energy General Assembly',
      }),
    ).toBe(true);
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'unknown-slug',
        spaceTitle: 'Hypha Energy General Assembly',
      }),
    ).toBe(true);
  });

  it('does not match other Hypha-branded or LocalScale spaces', () => {
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'hypha',
        spaceTitle: 'Hypha',
      }),
    ).toBe(false);
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'hypha-platform',
        spaceTitle: 'Hypha Platform',
      }),
    ).toBe(false);
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'ponta-do-sol-energy-community',
        spaceTitle: 'Ponta do Sol Energy Community',
      }),
    ).toBe(false);
  });
});

describe('extraSharedDistributionTokenAddresses', () => {
  it('adds HYPHA for Hypha-branded spaces and EPARTS for Hypha Energy spaces', () => {
    const capital = extraSharedDistributionTokenAddresses({
      spaceSlug: 'hypha-energy-capital',
      spaceTitle: 'Hypha Energy Capital BV',
    });
    expect(capital.map((address) => address.toLowerCase())).toEqual([
      HYPHA_TOKEN_ADDRESS.toLowerCase(),
      EPARTS_TOKEN_ADDRESS.toLowerCase(),
    ]);

    const platform = extraSharedDistributionTokenAddresses({
      spaceSlug: 'hypha-platform',
      spaceTitle: 'Hypha Platform',
    });
    expect(platform.map((address) => address.toLowerCase())).toEqual([
      HYPHA_TOKEN_ADDRESS.toLowerCase(),
    ]);
  });

  it('adds nothing for unrelated spaces', () => {
    expect(
      extraSharedDistributionTokenAddresses({
        spaceSlug: 'localscale',
        spaceTitle: 'LocalScale',
      }),
    ).toEqual([]);
  });
});

describe('EPARTS_TOKEN_ADDRESS', () => {
  it('is the Hypha Energy ownership proxy in EIP-55 form', () => {
    expect(EPARTS_TOKEN_ADDRESS).toBe(
      '0x5d3394CAa6D09214aB86CF048e39dea058eC1921',
    );
    expect(getAddress(EPARTS_TOKEN_ADDRESS)).toBe(EPARTS_TOKEN_ADDRESS);
    expect(isEpartsToken(EPARTS_TOKEN_ADDRESS)).toBe(true);
    expect(isEpartsToken(EPARTS_TOKEN_ADDRESS.toLowerCase())).toBe(true);
    expect(isEpartsToken(HYPHA_TOKEN_ADDRESS)).toBe(false);
  });
});
