import { describe, expect, it, vi } from 'vitest';

// banking-ui pulls these from @hypha-platform/core/client, whose barrel loads
// storage-postgres (needs a DB URL). Mock with the real rail/destination values
// so this stays a pure unit test of the per-pair filtering.
vi.mock('@hypha-platform/core/client', () => ({
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

import { getAvailableAddAccountRailOptions } from './banking-ui';
import type {
  BankCustomerPublicStatus,
  BankRailPublicStatus,
  BankVirtualAccountPublic,
} from './hooks/types';

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
        operationalStatus: 'active',
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
        operationalStatus: 'active',
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
        operationalStatus: 'active',
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
      rail({ currency: 'eur', paymentRail: 'sepa', operationalStatus: 'approved' }),
    ]);

    const options = getAvailableAddAccountRailOptions(status, []);

    expect(options[0]?.destinationCurrencies).toEqual(['usdc', 'eurc']);
  });
});
