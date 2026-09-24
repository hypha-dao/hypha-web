import { describe, expect, it } from 'vitest';

import { resolveAuddCompanyType } from '../company-type';
import { BankOnboardingError } from '../../../errors';

describe('resolveAuddCompanyType', () => {
  it('defaults individual entities to INDIVIDUAL with no form value', () => {
    expect(resolveAuddCompanyType('individual', undefined)).toBe('INDIVIDUAL');
  });

  it('requires a companyType for business entities with no form value', () => {
    expect(() => resolveAuddCompanyType('business', undefined)).toThrow(
      BankOnboardingError,
    );
  });

  it('rejects a non-INDIVIDUAL companyType for an individual entity', () => {
    expect(() => resolveAuddCompanyType('individual', 'SOLE_TRADER')).toThrow(
      /conflicts with entity type "individual"/,
    );
  });

  it('rejects an INDIVIDUAL companyType for a business entity', () => {
    expect(() => resolveAuddCompanyType('business', 'INDIVIDUAL')).toThrow(
      /conflicts with entity type "business"/,
    );
  });

  it('accepts a matching business companyType', () => {
    expect(resolveAuddCompanyType('business', 'private_company')).toBe(
      'PRIVATE_COMPANY',
    );
  });

  it('rejects an unsupported companyType value', () => {
    expect(() => resolveAuddCompanyType('business', 'NOT_A_TYPE')).toThrow(
      /Unsupported AUDD companyType/,
    );
  });
});
