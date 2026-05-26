import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  bridgeTransferTargetsSpace,
  bridgeVirtualAccountTargetsSpace,
  mapBridgeTransferToPublic,
  mapBridgeVirtualAccountToPublic,
} from '../map-bridge-resources';

const SPACE_TREASURY = '0x1111111111111111111111111111111111111111';
const OTHER_TREASURY = '0x2222222222222222222222222222222222222222';

describe('mapBridgeVirtualAccountToPublic', () => {
  it('maps Bridge virtual account to public shape', () => {
    const result = mapBridgeVirtualAccountToPublic(
      {
        id: 'va_1',
        status: 'activated',
        source_deposit_instructions: {
          currency: 'eur',
          iban: 'DE89370400440532013000',
        },
        source: { currency: 'eur', payment_rail: 'sepa' },
      },
      '0xtreasury',
      'sepa',
    );

    expect(result.id).toBe('va_1');
    expect(result.currency).toBe('eur');
    expect(result.paymentRail).toBe('sepa');
    expect(result.depositInstructions.iban).toBe('DE89370400440532013000');
  });
});

describe('bridgeTransferTargetsSpace', () => {
  it('matches transfer destination to space treasury (case-insensitive)', () => {
    expect(
      bridgeTransferTargetsSpace(
        {
          id: 'tr_1',
          state: 'awaiting_funds',
          source_deposit_instructions: {},
          destination: {
            to_address: '0x1111111111111111111111111111111111111111',
          },
        },
        SPACE_TREASURY,
      ),
    ).toBe(true);
  });

  it('excludes transfers for another treasury', () => {
    expect(
      bridgeTransferTargetsSpace(
        {
          id: 'tr_2',
          state: 'awaiting_funds',
          source_deposit_instructions: {},
          destination: { to_address: OTHER_TREASURY },
        },
        SPACE_TREASURY,
      ),
    ).toBe(false);
  });
});

describe('bridgeVirtualAccountTargetsSpace', () => {
  it('matches virtual account destination to space treasury', () => {
    expect(
      bridgeVirtualAccountTargetsSpace(
        {
          id: 'va_1',
          status: 'activated',
          source_deposit_instructions: { currency: 'usd' },
          destination: { address: SPACE_TREASURY, currency: 'usdc', payment_rail: 'base' },
        },
        SPACE_TREASURY,
      ),
    ).toBe(true);
  });
});

describe('mapBridgeTransferToPublic', () => {
  it('maps Bridge transfer to public shape', () => {
    const result = mapBridgeTransferToPublic(
      {
        id: 'tr_1',
        state: 'awaiting_funds',
        amount: '100.00',
        currency: 'eur',
        source: { payment_rail: 'sepa', currency: 'eur' },
        source_deposit_instructions: {
          iban: 'DE89370400440532013000',
          deposit_message: 'ref-1',
        },
        destination: { to_address: '0xtreasury' },
        created_at: '2026-01-01T00:00:00Z',
      },
      '0xtreasury',
    );

    expect(result.id).toBe('tr_1');
    expect(result.status).toBe('awaiting_funds');
    expect(result.depositMessage).toBe('ref-1');
  });
});
