import { describe, expect, it } from 'vitest';

import { AUDD_REQUIRED_ONBOARDING_FIELDS } from '../onboarding-fields';

describe('AUDD companyType options vs entity type', () => {
  const options =
    AUDD_REQUIRED_ONBOARDING_FIELDS.find((f) => f.key === 'companyType')
      ?.options ?? [];
  const forEntity = (entity: 'individual' | 'business') =>
    options
      .filter((o) => !o.entityTypes || o.entityTypes.includes(entity))
      .map((o) => o.value);

  it('offers only INDIVIDUAL to an individual owner', () => {
    expect(forEntity('individual')).toEqual(['INDIVIDUAL']);
  });

  it('never offers INDIVIDUAL to a business owner (resolveAuddCompanyType would reject it)', () => {
    expect(forEntity('business')).toEqual([
      'SOLE_TRADER',
      'PRIVATE_COMPANY',
      'PUBLIC_COMPANY',
      'TRUST',
    ]);
  });
});
