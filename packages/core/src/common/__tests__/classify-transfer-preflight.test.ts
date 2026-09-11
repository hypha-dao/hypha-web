import { describe, expect, it } from 'vitest';
import { classifyTransferPreflight } from '../classify-transfer-preflight';

describe('classifyTransferPreflight', () => {
  it('allows a spend covered by remaining address-whitelist credit without creditEligible', () => {
    expect(
      classifyTransferPreflight({
        amount: 1,
        balance: 0,
        symbol: 'CLARINE',
        mutualCredit: {
          creditEligible: false,
          addressWhitelisted: true,
          creditLimit: 48,
          creditLimitLeft: 48,
        },
      }),
    ).toEqual({ status: 'ok' });
  });

  it('uses creditLimitLeft even when the space-only eligible flag is false', () => {
    expect(
      classifyTransferPreflight({
        amount: 1,
        balance: 0,
        symbol: 'CLARINE',
        mutualCredit: {
          creditEligible: false,
          creditLimit: 48,
          creditLimitLeft: 10,
        },
      }),
    ).toEqual({ status: 'ok' });
  });

  it('reports credit_limit when an eligible account exceeds remaining credit', () => {
    expect(
      classifyTransferPreflight({
        amount: 20,
        balance: 1,
        symbol: 'CLARINE',
        mutualCredit: {
          creditEligible: true,
          addressWhitelisted: true,
          creditLimit: 10,
          creditLimitLeft: 5,
        },
      }),
    ).toEqual({
      status: 'credit_limit',
      symbol: 'CLARINE',
      balance: 1,
      creditLeft: 5,
      creditLimit: 10,
      spendable: 6,
    });
  });

  it('does not call a missing credit line a credit-limit breach', () => {
    expect(
      classifyTransferPreflight({
        amount: 1,
        balance: 0,
        symbol: 'CLARINE',
        mutualCredit: {
          creditEligible: false,
          addressWhitelisted: false,
          creditLimit: 0,
          creditLimitLeft: 0,
        },
      }),
    ).toEqual({
      status: 'not_credit_eligible',
      symbol: 'CLARINE',
      balance: 0,
    });
  });

  it('falls back to insufficient funds when the token has no credit context', () => {
    expect(
      classifyTransferPreflight({
        amount: 2,
        balance: 1,
        symbol: 'USDC',
      }),
    ).toEqual({ status: 'insufficient_funds', isHypha: false });
  });

  it('flags HYPHA separately when there is no credit context', () => {
    expect(
      classifyTransferPreflight({
        amount: 2,
        balance: 1,
        symbol: 'HYPHA',
      }),
    ).toEqual({ status: 'insufficient_funds', isHypha: true });
  });
});
