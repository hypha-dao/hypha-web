import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  signBankConfirmationJwt,
  verifyBankConfirmationJwt,
} from '../sign-bank-confirmation-jwt';

describe('sign-bank-confirmation-jwt', () => {
  beforeEach(() => {
    process.env.INTERNAL_JWT_SECRET = 'test-secret-for-bank-email-confirmation';
  });

  afterEach(() => {
    delete process.env.INTERNAL_JWT_SECRET;
  });

  it('round-trips payload fields', async () => {
    const token = await signBankConfirmationJwt({
      jti: '11111111-1111-1111-1111-111111111111',
      spaceId: 1,
      spaceSlug: 'acme',
      spaceBankCustomerId: 42,
      provider: 'bridge',
      providerCustomerEmail: 'compliance@acme.org',
      legalName: 'Acme Foundation Ltd.',
      requestedRails: ['eur', 'usd'],
      personSlug: 'alice',
      spaceTitle: 'Acme',
      redirectUri: 'https://app.example/en/dho/acme/banking',
    });

    const payload = await verifyBankConfirmationJwt(token);

    expect(payload.jti).toBe('11111111-1111-1111-1111-111111111111');
    expect(payload.spaceId).toBe(1);
    expect(payload.spaceBankCustomerId).toBe(42);
    expect(payload.providerCustomerEmail).toBe('compliance@acme.org');
    expect(payload.requestedRails).toEqual(['eur', 'usd']);
  });
});
