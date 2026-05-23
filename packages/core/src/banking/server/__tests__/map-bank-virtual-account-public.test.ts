import { describe, expect, it } from 'vitest';

import { mapBankVirtualAccountToPublic } from '../map-bank-virtual-account-public';

describe('mapBankVirtualAccountToPublic', () => {
  it('maps active provisioned accounts', () => {
    const result = mapBankVirtualAccountToPublic({
      id: 1,
      currency: 'eur',
      paymentRail: 'sepa',
      providerVirtualAccountId: 'va_1',
      depositInstructions: { iban: 'DE00' },
      destinationAddress: '0xabc',
      status: 'activated',
      isApproved: true,
    } as never);

    expect(result).toMatchObject({
      lifecycle: 'active',
      canActivate: false,
      approvalRegistered: true,
    });
  });

  it('maps pending activation when DB isApproved without provider resource', () => {
    const result = mapBankVirtualAccountToPublic({
      id: 2,
      currency: 'usd',
      paymentRail: 'ach',
      providerVirtualAccountId: null,
      depositInstructions: {},
      destinationAddress: '0xabc',
      status: 'pending_activation',
      isApproved: true,
    } as never);

    expect(result).toMatchObject({
      lifecycle: 'pending_activation',
      canActivate: true,
      approvalRegistered: true,
    });
  });

  it('maps pending_kyb when corridor is not approved in DB', () => {
    const result = mapBankVirtualAccountToPublic({
      id: 3,
      currency: 'mxn',
      paymentRail: 'spei',
      providerVirtualAccountId: null,
      depositInstructions: {},
      destinationAddress: '0xabc',
      status: 'pending_kyb',
      isApproved: false,
    } as never);

    expect(result).toMatchObject({
      lifecycle: 'pending_kyb',
      canActivate: false,
      approvalRegistered: false,
    });
  });
});
