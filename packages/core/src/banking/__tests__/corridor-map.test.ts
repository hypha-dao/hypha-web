import { describe, expect, it } from 'vitest';

import {
  BANK_TRANSFER_CORRIDOR_KEYS,
  BANK_TRANSFER_CORRIDORS,
  getTransferCorridorKeyFromStored,
  resolveBankTransferCorridor,
} from '../constants';

describe('bank transfer corridors', () => {
  it('defines all seven corridor keys', () => {
    expect(BANK_TRANSFER_CORRIDOR_KEYS).toHaveLength(7);
    expect(BANK_TRANSFER_CORRIDOR_KEYS).toContain('usd-ach');
    expect(BANK_TRANSFER_CORRIDOR_KEYS).toContain('usd-wire');
  });

  it('resolves corridorKey to currency and paymentRail', () => {
    expect(resolveBankTransferCorridor({ corridorKey: 'usd-wire' })).toEqual({
      corridorKey: 'usd-wire',
      currency: 'usd',
      paymentRail: 'wire',
    });
    expect(resolveBankTransferCorridor({ corridorKey: 'eur' })).toEqual({
      corridorKey: 'eur',
      currency: 'eur',
      paymentRail: 'sepa',
    });
  });

  it('defaults legacy currency input to ACH for USD', () => {
    expect(resolveBankTransferCorridor({ currency: 'usd' })).toEqual({
      corridorKey: 'usd-ach',
      currency: 'usd',
      paymentRail: 'ach_push',
    });
  });

  it('distinguishes USD ACH from USD wire when stored', () => {
    expect(getTransferCorridorKeyFromStored('usd', 'ach_push')).toBe('usd-ach');
    expect(getTransferCorridorKeyFromStored('usd', 'wire')).toBe('usd-wire');
    expect(BANK_TRANSFER_CORRIDORS['usd-ach'].paymentRail).not.toBe(
      BANK_TRANSFER_CORRIDORS['usd-wire'].paymentRail,
    );
  });
});
