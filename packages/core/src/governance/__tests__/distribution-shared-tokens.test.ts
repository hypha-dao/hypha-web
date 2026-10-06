import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';

import {
  EPARTS_TOKEN_ADDRESS,
  HYPHA_TOKEN_ADDRESS,
  isEpartsToken,
} from '../../common/web3/tokens';
import {
  extraSharedDistributionTokenAddresses,
  HYPHA_ENERGY_CAPITAL_SPACE_ID,
  HYPHA_ENERGY_GENERAL_ASSEMBLY_SPACE_ID,
  HYPHA_ENERGY_SPACE_ID,
  shouldIncludeHyphaEnergyOwnershipToken,
  shouldIncludeHyphaSharedToken,
  shouldIncludeParentOwnershipTokens,
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
  it('matches Hypha Energy slugs and the canonical Capital BV / GA / home ids', () => {
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'hypha-energy',
        spaceTitle: 'Hypha Energy',
        spaceId: HYPHA_ENERGY_SPACE_ID,
      }),
    ).toBe(true);
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'hypha-energy-capital',
        spaceTitle: 'Hypha Energy Capital BV',
        spaceId: HYPHA_ENERGY_CAPITAL_SPACE_ID,
      }),
    ).toBe(true);
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'some-other-slug',
        spaceTitle: 'General Assembly',
        spaceId: HYPHA_ENERGY_GENERAL_ASSEMBLY_SPACE_ID,
      }),
    ).toBe(true);
  });

  it('keeps Capital BV and GA even when parent access is denied', () => {
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'child-space',
        spaceTitle: 'Capital',
        spaceId: HYPHA_ENERGY_CAPITAL_SPACE_ID,
        parentId: HYPHA_ENERGY_SPACE_ID,
        parentAccess: { hasAccess: false },
      }),
    ).toBe(true);
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'ga',
        spaceTitle: 'General Assembly',
        spaceId: HYPHA_ENERGY_GENERAL_ASSEMBLY_SPACE_ID,
        parentId: HYPHA_ENERGY_SPACE_ID,
        parentAccess: null,
      }),
    ).toBe(true);
  });

  it('includes a Hypha Energy child only when the caller can see the parent', () => {
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'child-space',
        spaceTitle: 'Child',
        parentId: HYPHA_ENERGY_SPACE_ID,
        parentAccess: { hasAccess: true },
      }),
    ).toBe(true);
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'child-space',
        spaceTitle: 'Child',
        parentId: HYPHA_ENERGY_SPACE_ID,
        parentAccess: { hasAccess: false },
      }),
    ).toBe(false);
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'child-space',
        spaceTitle: 'Child',
        parentId: HYPHA_ENERGY_SPACE_ID,
        parentAccess: null,
      }),
    ).toBe(false);
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'child-space',
        spaceTitle: 'Child',
        parentId: HYPHA_ENERGY_SPACE_ID,
      }),
    ).toBe(false);
  });

  it('does not match a title-only Hypha Energy prefix or unrelated spaces', () => {
    expect(
      shouldIncludeHyphaEnergyOwnershipToken({
        spaceSlug: 'unknown-slug',
        spaceTitle: 'Hypha Energy Community',
      }),
    ).toBe(false);
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

describe('shouldIncludeParentOwnershipTokens', () => {
  it('includes parent tokens only when parent access is granted', () => {
    expect(shouldIncludeParentOwnershipTokens({ hasAccess: true })).toBe(true);
    expect(shouldIncludeParentOwnershipTokens({ hasAccess: false })).toBe(
      false,
    );
    expect(shouldIncludeParentOwnershipTokens(null)).toBe(false);
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

  it('omits EPARTS for a Hypha Energy child when parent access is denied', () => {
    expect(
      extraSharedDistributionTokenAddresses({
        spaceSlug: 'child-space',
        spaceTitle: 'Child',
        parentId: HYPHA_ENERGY_SPACE_ID,
        parentAccess: { hasAccess: false },
      }),
    ).toEqual([]);
  });

  it('still adds EPARTS for Capital BV when parent access is denied', () => {
    const capital = extraSharedDistributionTokenAddresses({
      spaceSlug: 'other-slug',
      spaceTitle: 'Capital',
      spaceId: HYPHA_ENERGY_CAPITAL_SPACE_ID,
      parentId: HYPHA_ENERGY_SPACE_ID,
      parentAccess: { hasAccess: false },
    });
    expect(capital.map((address) => address.toLowerCase())).toEqual([
      EPARTS_TOKEN_ADDRESS.toLowerCase(),
    ]);
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
