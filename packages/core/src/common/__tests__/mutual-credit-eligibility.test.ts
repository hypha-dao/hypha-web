import { describe, expect, it } from 'vitest';
import { isMutualCreditEligible } from '../mutual-credit-eligibility';

describe('isMutualCreditEligible', () => {
  it('is true when the address is credit-whitelisted', () => {
    expect(
      isMutualCreditEligible({
        addressWhitelisted: true,
        creditLimit: 0,
        whitelistedSpaceIds: [],
        memberWeb3SpaceIds: [],
      }),
    ).toBe(true);
  });

  it('is true when creditLimitOf is already positive', () => {
    expect(
      isMutualCreditEligible({
        addressWhitelisted: false,
        creditLimit: 48,
        whitelistedSpaceIds: [],
        memberWeb3SpaceIds: [],
      }),
    ).toBe(true);
  });

  it('is true when the user is in a credit-whitelisted space', () => {
    expect(
      isMutualCreditEligible({
        addressWhitelisted: false,
        creditLimit: 0,
        whitelistedSpaceIds: [42, 99],
        memberWeb3SpaceIds: [7, 42],
      }),
    ).toBe(true);
  });

  it('is false when only space membership exists (wrong whitelist)', () => {
    expect(
      isMutualCreditEligible({
        addressWhitelisted: false,
        creditLimit: 0,
        whitelistedSpaceIds: [99],
        memberWeb3SpaceIds: [7, 42],
      }),
    ).toBe(false);
  });

  it('is false with no address, limit, or overlapping space', () => {
    expect(
      isMutualCreditEligible({
        addressWhitelisted: false,
        creditLimit: 0,
        whitelistedSpaceIds: [],
        memberWeb3SpaceIds: [1],
      }),
    ).toBe(false);
  });
});
