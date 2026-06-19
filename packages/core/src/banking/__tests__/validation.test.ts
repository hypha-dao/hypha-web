import { describe, expect, it } from 'vitest';

import {
  schemaCreateBankTransfer,
  schemaCreatePayoutAccount,
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

  it('accepts eurc for sepa virtual accounts', () => {
    const result = schemaProvisionVirtualAccount.safeParse({
      currency: 'eur',
      destinationCurrency: 'eurc',
    });
    expect(result.success).toBe(true);
  });

  it('rejects eurc for usd ach virtual accounts', () => {
    const result = schemaProvisionVirtualAccount.safeParse({
      currency: 'usd',
      destinationCurrency: 'eurc',
    });
    expect(result.success).toBe(false);
  });
});

describe('schemaCreateBankTransfer', () => {
  it('accepts corridorKey', () => {
    const result = schemaCreateBankTransfer.safeParse({
      corridorKey: 'usd-wire',
    });
    expect(result.success).toBe(true);
  });

  it('accepts legacy currency fallback', () => {
    const result = schemaCreateBankTransfer.safeParse({ currency: 'eur' });
    expect(result.success).toBe(true);
  });

  it('requires corridorKey or currency', () => {
    const result = schemaCreateBankTransfer.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts eurc for eur sepa transfers', () => {
    const result = schemaCreateBankTransfer.safeParse({
      corridorKey: 'eur',
      destinationCurrency: 'eurc',
    });
    expect(result.success).toBe(true);
  });

  it('rejects eurc for usd wire transfers', () => {
    const result = schemaCreateBankTransfer.safeParse({
      corridorKey: 'usd-wire',
      destinationCurrency: 'eurc',
    });
    expect(result.success).toBe(false);
  });
});

describe('schemaCreatePayoutAccount', () => {
  const validAddress = {
    street_line_1: '123 Main St',
    city: 'San Francisco',
    postal_code: '94107',
    country: 'USA',
  };

  const baseUsd = {
    railKey: 'usd_ach',
    sourceCurrency: 'usdc',
    bankName: 'Lead Bank',
    accountName: 'Operating',
    accountOwnerName: 'Acme DAO',
    routingNumber: '101019644',
    accountNumber: '215268129',
    address: validAddress,
  };

  it('accepts valid USD ACH input', () => {
    expect(schemaCreatePayoutAccount.safeParse(baseUsd).success).toBe(true);
  });

  it('rejects USD ACH without routingNumber', () => {
    const { routingNumber: _r, ...input } = baseUsd;
    expect(schemaCreatePayoutAccount.safeParse(input).success).toBe(false);
  });

  it('rejects USD ACH without accountNumber', () => {
    const { accountNumber: _a, ...input } = baseUsd;
    expect(schemaCreatePayoutAccount.safeParse(input).success).toBe(false);
  });

  it('rejects USD ACH accountOwnerName under 3 chars', () => {
    expect(
      schemaCreatePayoutAccount.safeParse({
        ...baseUsd,
        accountOwnerName: 'AB',
      }).success,
    ).toBe(false);
  });

  it('rejects USD ACH accountOwnerName over 35 chars', () => {
    expect(
      schemaCreatePayoutAccount.safeParse({
        ...baseUsd,
        accountOwnerName: 'A'.repeat(36),
      }).success,
    ).toBe(false);
  });

  it('rejects unknown fields (strict mode)', () => {
    expect(
      schemaCreatePayoutAccount.safeParse({ ...baseUsd, unknownField: 'x' })
        .success,
    ).toBe(false);
  });

  const baseGbp = {
    railKey: 'gbp',
    sourceCurrency: 'usdc',
    bankName: 'Barclays',
    accountName: 'Operating',
    accountOwnerName: 'Acme DAO',
    sortCode: '200000',
    accountNumber: '12345678',
    address: {
      street_line_1: '10 Downing St',
      city: 'London',
      postal_code: 'SW1A 2AA',
      country: 'GBR',
    },
  };

  it('accepts valid GBP input', () => {
    expect(schemaCreatePayoutAccount.safeParse(baseGbp).success).toBe(true);
  });

  it('accepts GBP sortCode with hyphens (normalised to 6 digits)', () => {
    expect(
      schemaCreatePayoutAccount.safeParse({ ...baseGbp, sortCode: '20-00-00' })
        .success,
    ).toBe(true);
  });

  it('rejects GBP sortCode shorter than 6 digits', () => {
    expect(
      schemaCreatePayoutAccount.safeParse({ ...baseGbp, sortCode: '12345' })
        .success,
    ).toBe(false);
  });

  it('rejects GBP sortCode longer than 6 digits', () => {
    expect(
      schemaCreatePayoutAccount.safeParse({ ...baseGbp, sortCode: '1234567' })
        .success,
    ).toBe(false);
  });

  it('rejects GBP accountNumber with 7 digits', () => {
    expect(
      schemaCreatePayoutAccount.safeParse({
        ...baseGbp,
        accountNumber: '1234567',
      }).success,
    ).toBe(false);
  });

  it('rejects GBP accountNumber with 9 digits', () => {
    expect(
      schemaCreatePayoutAccount.safeParse({
        ...baseGbp,
        accountNumber: '123456789',
      }).success,
    ).toBe(false);
  });

  it('rejects GBP without sortCode', () => {
    const { sortCode: _s, ...input } = baseGbp;
    expect(schemaCreatePayoutAccount.safeParse(input).success).toBe(false);
  });

  it('rejects GBP without accountNumber', () => {
    const { accountNumber: _a, ...input } = baseGbp;
    expect(schemaCreatePayoutAccount.safeParse(input).success).toBe(false);
  });

  const baseEur = {
    railKey: 'eur_sepa',
    sourceCurrency: 'usdc',
    bankName: 'ING',
    accountName: 'Operating',
    accountOwnerName: 'Acme DAO',
    iban: 'DE89370400440532013000',
    address: {
      street_line_1: 'Hauptstraße 1',
      city: 'Berlin',
      postal_code: '10115',
      country: 'DEU',
    },
  };

  it('accepts valid EUR SEPA business input', () => {
    expect(schemaCreatePayoutAccount.safeParse(baseEur).success).toBe(true);
  });

  it('rejects EUR SEPA without iban', () => {
    const { iban: _i, ...input } = baseEur;
    expect(schemaCreatePayoutAccount.safeParse(input).success).toBe(false);
  });

  it('accepts firstName and lastName for EUR SEPA individual', () => {
    expect(
      schemaCreatePayoutAccount.safeParse({
        ...baseEur,
        accountOwnerType: 'individual',
        firstName: 'Jane',
        lastName: 'Doe',
        accountOwnerName: 'Jane Doe',
      }).success,
    ).toBe(true);
  });

  it('rejects EUR SEPA individual without firstName', () => {
    expect(
      schemaCreatePayoutAccount.safeParse({
        ...baseEur,
        accountOwnerType: 'individual',
        lastName: 'Doe',
        accountOwnerName: 'Jane Doe',
      }).success,
    ).toBe(false);
  });

  it('rejects EUR SEPA individual without lastName', () => {
    expect(
      schemaCreatePayoutAccount.safeParse({
        ...baseEur,
        accountOwnerType: 'individual',
        firstName: 'Jane',
        accountOwnerName: 'Jane Doe',
      }).success,
    ).toBe(false);
  });

  it('rejects EUR SEPA business without businessName', () => {
    expect(
      schemaCreatePayoutAccount.safeParse({
        ...baseEur,
        accountOwnerType: 'business',
      }).success,
    ).toBe(false);
  });
});
