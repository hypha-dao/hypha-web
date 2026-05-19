import { describe, expect, it } from 'vitest';

import { schemaSpaceBankCustomerOnboarding } from '../validation';

describe('schemaSpaceBankCustomerOnboarding', () => {
  it('requires legalName and contactEmail', () => {
    const result = schemaSpaceBankCustomerOnboarding.safeParse({});
    expect(result.success).toBe(false);
  });

  it('leaves endorsements undefined when omitted', () => {
    const result = schemaSpaceBankCustomerOnboarding.safeParse({
      legalName: 'Acme Foundation Ltd.',
      contactEmail: 'compliance@acme.org',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endorsements).toBeUndefined();
    }
  });

  it('accepts endorsements as opaque strings (provider validates rails)', () => {
    const result = schemaSpaceBankCustomerOnboarding.safeParse({
      legalName: 'Acme Foundation Ltd.',
      contactEmail: 'compliance@acme.org',
      endorsements: ['sepa', 'custom-rail-id'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endorsements).toEqual(['sepa', 'custom-rail-id']);
    }
  });

  it('rejects unknown redirectUri in the body', () => {
    const result = schemaSpaceBankCustomerOnboarding.safeParse({
      legalName: 'Acme Foundation Ltd.',
      contactEmail: 'compliance@acme.org',
      redirectUri: 'https://evil.example/phish',
    });
    expect(result.success).toBe(false);
  });
});
