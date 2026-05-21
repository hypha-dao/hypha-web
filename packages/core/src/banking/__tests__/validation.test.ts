import { describe, expect, it } from 'vitest';

import {
  schemaProvisionVirtualAccount,
  schemaSpaceBankCustomerOnboarding,
} from '../validation';

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

describe('schemaProvisionVirtualAccount', () => {
  it('accepts supported currencies', () => {
    for (const currency of [
      'eur',
      'usd',
      'gbp',
      'mxn',
      'brl',
      'cop',
    ] as const) {
      const result = schemaProvisionVirtualAccount.safeParse({ currency });
      expect(result.success).toBe(true);
    }
  });

  it('rejects unsupported currency', () => {
    const result = schemaProvisionVirtualAccount.safeParse({ currency: 'kes' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields', () => {
    const result = schemaProvisionVirtualAccount.safeParse({
      currency: 'eur',
      extra: true,
    });
    expect(result.success).toBe(false);
  });
});
