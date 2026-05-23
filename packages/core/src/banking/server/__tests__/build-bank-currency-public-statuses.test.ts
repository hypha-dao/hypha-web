import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildBankCurrencyPublicStatuses } from '../build-bank-currency-public-statuses';

describe('buildBankCurrencyPublicStatuses', () => {
  it('marks provisioned accounts as active', () => {
    const statuses = buildBankCurrencyPublicStatuses({
      customer: {
        endorsements: ['base', 'sepa'],
      } as never,
      accounts: [
        {
          currency: 'eur',
          providerVirtualAccountId: 'va_1',
          isApproved: true,
          status: 'activated',
        },
      ] as never,
      endorsementStatusMap: new Map([['sepa', 'approved']]),
    });

    expect(statuses).toEqual([
      expect.objectContaining({
        currency: 'eur',
        operationalStatus: 'active',
        isApproved: true,
      }),
      expect.objectContaining({
        currency: 'usd',
        operationalStatus: 'not_opened',
      }),
    ]);
  });

  it('marks approved but unprovisioned accounts as approved', () => {
    const statuses = buildBankCurrencyPublicStatuses({
      customer: {
        endorsements: ['base'],
      } as never,
      accounts: [
        {
          id: 42,
          currency: 'usd',
          providerVirtualAccountId: null,
          isApproved: true,
          status: 'pending_activation',
        },
      ] as never,
    });

    expect(statuses).toEqual([
      expect.objectContaining({
        currency: 'usd',
        virtualAccountId: 42,
        operationalStatus: 'approved',
        isApproved: true,
      }),
    ]);
  });

  it('keeps default endorsed corridors not_opened when only Bridge approves them', () => {
    const statuses = buildBankCurrencyPublicStatuses({
      customer: {
        endorsements: ['base', 'sepa'],
      } as never,
      accounts: [
        {
          id: 1,
          currency: 'mxn',
          providerVirtualAccountId: null,
          isApproved: false,
          status: 'pending_kyb',
        },
      ] as never,
      endorsementStatusMap: new Map([
        ['base', 'approved'],
        ['sepa', 'approved'],
      ]),
    });

    expect(statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currency: 'eur',
          virtualAccountId: null,
          operationalStatus: 'not_opened',
          isApproved: false,
        }),
        expect.objectContaining({
          currency: 'usd',
          virtualAccountId: null,
          operationalStatus: 'not_opened',
          isApproved: false,
        }),
        expect.objectContaining({
          currency: 'mxn',
          virtualAccountId: 1,
          operationalStatus: 'not_approved',
          isApproved: false,
        }),
      ]),
    );
  });
});
