import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getAddAccountRailOptions } from '../get-add-account-rail-options';

const findBankCustomerBySpaceAndProvider = vi.fn();
const loadBankingProviderState = vi.fn();
const buildRailStatuses = vi.fn();

vi.mock('../queries', () => ({
  findBankCustomerBySpaceAndProvider: (...args: unknown[]) =>
    findBankCustomerBySpaceAndProvider(...args),
}));

vi.mock('../providers/bridge/banking-provider-state', () => ({
  loadBankingProviderState: (...args: unknown[]) =>
    loadBankingProviderState(...args),
  buildRailStatuses: (...args: unknown[]) => buildRailStatuses(...args),
}));

const mockDb = {} as never;
const mockSpace = { id: 1 };

describe('getAddAccountRailOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findBankCustomerBySpaceAndProvider.mockResolvedValue({
      id: 1,
      requestedRails: ['usd'],
    });
    loadBankingProviderState.mockResolvedValue({});
    buildRailStatuses.mockReturnValue([
      {
        railKey: 'usd',
        currency: 'usd',
        paymentRail: 'ach',
        endorsement: 'base',
        operationalStatus: 'approved',
        validation: {},
        hasVirtualAccount: false,
      },
      {
        railKey: 'usd-ach',
        currency: 'usd',
        paymentRail: 'ach_push',
        endorsement: 'base',
        operationalStatus: 'approved',
        validation: {},
        hasVirtualAccount: false,
      },
      {
        railKey: 'usd-wire',
        currency: 'usd',
        paymentRail: 'wire',
        endorsement: 'base',
        operationalStatus: 'approved',
        validation: {},
        hasVirtualAccount: false,
      },
      {
        railKey: 'eur',
        currency: 'eur',
        paymentRail: 'sepa',
        endorsement: 'sepa',
        operationalStatus: 'approved',
        validation: {},
        hasVirtualAccount: true,
      },
    ]);
  });

  it('returns one option per virtual-account currency, not transfer corridors', async () => {
    const options = await getAddAccountRailOptions(mockSpace, { db: mockDb });

    expect(options.map((o) => o.railKey)).toEqual(['usd']);
    expect(options[0]?.currency).toBe('usd');
  });
});
