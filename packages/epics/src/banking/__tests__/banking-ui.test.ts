import { describe, expect, it, vi } from 'vitest';

// banking-ui pulls these from @hypha-platform/core/client, whose barrel loads
// storage-postgres (needs a DB URL). Mock with the real rail/destination values
// so this stays a pure unit test of the per-pair filtering.
vi.mock('@hypha-platform/core/client', () => ({
  BANK_VIRTUAL_ACCOUNT_CURRENCIES: ['eur', 'usd', 'gbp', 'mxn', 'brl', 'cop'],
  BANK_ONBOARDING_CURRENCIES: ['eur', 'usd', 'gbp', 'mxn', 'brl', 'cop', 'aud'],
  BANK_PAYOUT_RAILS: {},
  bankProviderManifest: {
    bridge: {
      supportedCurrencies: ['eur', 'usd', 'gbp', 'mxn', 'brl', 'cop'],
      requiredOnboardingFields: [
        {
          key: 'contactEmail',
          kind: 'email',
          required: true,
          i18nLabelKey: 'x',
        },
        { key: 'legalName', kind: 'text', required: true, i18nLabelKey: 'x' },
      ],
    },
    audd: {
      supportedCurrencies: ['aud'],
      requiredOnboardingFields: [
        {
          key: 'contactEmail',
          kind: 'email',
          required: true,
          i18nLabelKey: 'x',
        },
        { key: 'firstName', kind: 'text', required: true, i18nLabelKey: 'x' },
        {
          key: 'registrationNumber',
          kind: 'text',
          required: false,
          i18nLabelKey: 'x',
          requiredIf: { key: 'companyType', notEquals: ['INDIVIDUAL'] },
        },
      ],
    },
  },
  getDestinationCurrenciesForSourceRail: (rail: string) =>
    rail === 'sepa' || rail === 'spei' ? ['usdc', 'eurc'] : ['usdc'],
  getDefaultDestinationCurrency: ({
    sourceCurrency,
    sourceRail,
  }: {
    sourceCurrency: string;
    sourceRail: string;
  }) => {
    const allowed =
      sourceRail === 'sepa' || sourceRail === 'spei'
        ? ['usdc', 'eurc']
        : ['usdc'];
    if (sourceCurrency === 'eur' && allowed.includes('eurc')) {
      return 'eurc';
    }
    return allowed[0] ?? 'usdc';
  },
}));

import {
  areOnboardingFieldsComplete,
  getAvailableAddAccountRailOptions,
  getDedupedOnboardingFields,
  isOnboardingFieldRequired,
  resolveOnboardingCurrencyProviders,
} from '../banking-ui';
import type {
  BankCustomerPublicStatus,
  BankRailPublicStatus,
  BankVirtualAccountPublic,
} from '../hooks/types';

function rail(
  overrides: Partial<BankRailPublicStatus> & {
    currency: string;
    paymentRail: string;
  },
): BankRailPublicStatus {
  return {
    railKey: overrides.currency,
    endorsement: overrides.currency,
    endorsementStatus: 'approved',
    operationalStatus: 'approved',
    validation: {
      key: overrides.currency,
      status: 'approved',
      isComplete: true,
    },
    hasVirtualAccount: false,
    ...overrides,
  };
}

function statusWith(rails: BankRailPublicStatus[]): BankCustomerPublicStatus {
  // Only railStatuses is read by getAddAccountRailOptionsFromStatus.
  return { railStatuses: rails } as BankCustomerPublicStatus;
}

function account(
  currency: string,
  destinationCurrency: string,
): BankVirtualAccountPublic {
  return {
    id: `va-${currency}-${destinationCurrency}`,
    currency,
    paymentRail: 'sepa',
    depositInstructions: { destination_currency: destinationCurrency },
    destinationAddress: '0xtreasury',
    status: 'activated',
    createdAt: null,
  };
}

describe('getAvailableAddAccountRailOptions (per-(currency,destination) dedup)', () => {
  it('keeps a multi-destination currency for its remaining destination (EUR/USDC taken -> EUR/EURC offered)', () => {
    const status = statusWith([
      rail({
        currency: 'eur',
        paymentRail: 'sepa',
        operationalStatus: 'approved',
        hasVirtualAccount: true,
      }),
    ]);

    const options = getAvailableAddAccountRailOptions(status, [
      account('eur', 'usdc'),
    ]);

    expect(options).toHaveLength(1);
    expect(options[0]?.currency).toBe('eur');
    expect(options[0]?.destinationCurrencies).toEqual(['eurc']);
    expect(options[0]?.defaultDestinationCurrency).toBe('eurc');
  });

  it('drops a currency once every destination it supports is provisioned', () => {
    const status = statusWith([
      rail({
        currency: 'eur',
        paymentRail: 'sepa',
        operationalStatus: 'approved',
        hasVirtualAccount: true,
      }),
    ]);

    const options = getAvailableAddAccountRailOptions(status, [
      account('eur', 'usdc'),
      account('eur', 'eurc'),
    ]);

    expect(options).toHaveLength(0);
  });

  it('drops a single-destination currency once its only destination is taken (USD/USDC)', () => {
    const status = statusWith([
      rail({
        currency: 'usd',
        paymentRail: 'ach',
        endorsement: 'base',
        operationalStatus: 'approved',
        hasVirtualAccount: true,
      }),
    ]);

    const options = getAvailableAddAccountRailOptions(status, [
      account('usd', 'usdc'),
    ]);

    expect(options).toHaveLength(0);
  });

  it('offers a currency with no accounts using all its destinations', () => {
    const status = statusWith([
      rail({
        currency: 'eur',
        paymentRail: 'sepa',
        operationalStatus: 'approved',
      }),
    ]);

    const options = getAvailableAddAccountRailOptions(status, []);

    expect(options[0]?.destinationCurrencies).toEqual(['usdc', 'eurc']);
  });
});

describe('resolveOnboardingCurrencyProviders / getDedupedOnboardingFields (D1/D10)', () => {
  it('resolves Bridge-only currencies to the bridge provider only', () => {
    expect(resolveOnboardingCurrencyProviders(['eur', 'usd'])).toEqual([
      'bridge',
    ]);
  });

  it('resolves aud to the audd provider only', () => {
    expect(resolveOnboardingCurrencyProviders(['aud'])).toEqual(['audd']);
  });

  it('resolves a mixed selection to both providers', () => {
    expect(resolveOnboardingCurrencyProviders(['eur', 'aud'])).toEqual([
      'bridge',
      'audd',
    ]);
  });

  it('dedupes the field union by key across providers', () => {
    const fields = getDedupedOnboardingFields(['eur', 'aud']);
    const keys = fields.map((f) => f.key);
    expect(keys).toEqual([
      'contactEmail',
      'legalName',
      'firstName',
      'registrationNumber',
    ]);
  });

  it('AUD-only fields exclude Bridge-only descriptors', () => {
    const fields = getDedupedOnboardingFields(['aud']);
    expect(fields.map((f) => f.key)).toEqual([
      'contactEmail',
      'firstName',
      'registrationNumber',
    ]);
  });
});

describe('isOnboardingFieldRequired / areOnboardingFieldsComplete (requiredIf)', () => {
  const registrationNumberField = getDedupedOnboardingFields(['aud']).find(
    (f) => f.key === 'registrationNumber',
  )!;

  it('is not required when the dependency value is absent', () => {
    expect(isOnboardingFieldRequired(registrationNumberField, {})).toBe(false);
  });

  it('is not required when companyType is INDIVIDUAL', () => {
    expect(
      isOnboardingFieldRequired(registrationNumberField, {
        companyType: 'INDIVIDUAL',
      }),
    ).toBe(false);
  });

  it('is required when companyType is a non-individual value', () => {
    expect(
      isOnboardingFieldRequired(registrationNumberField, {
        companyType: 'TRUST',
      }),
    ).toBe(true);
  });

  it('areOnboardingFieldsComplete only enforces conditionally-required fields once triggered', () => {
    const fields = getDedupedOnboardingFields(['aud']);

    expect(
      areOnboardingFieldsComplete(fields, {
        contactEmail: 'a@b.com',
        firstName: 'Ada',
        companyType: 'INDIVIDUAL',
      }),
    ).toBe(true);

    expect(
      areOnboardingFieldsComplete(fields, {
        contactEmail: 'a@b.com',
        firstName: 'Ada',
        companyType: 'TRUST',
      }),
    ).toBe(false);

    expect(
      areOnboardingFieldsComplete(fields, {
        contactEmail: 'a@b.com',
        firstName: 'Ada',
        companyType: 'TRUST',
        registrationNumber: '12345',
      }),
    ).toBe(true);
  });
});
