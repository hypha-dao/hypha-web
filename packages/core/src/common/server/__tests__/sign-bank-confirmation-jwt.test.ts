import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  signBankConfirmationJwt,
  verifyBankConfirmationJwt,
  type BankConfirmationJwtPayload,
} from '../sign-bank-confirmation-jwt';

const payload: BankConfirmationJwtPayload = {
  ownerType: 'space',
  ownerId: 1,
  ownerSlug: 'acme',
  ownerLabel: 'Acme',
  entityType: 'business',
  legalName: 'Acme Foundation Ltd.',
  contactEmail: 'compliance@acme.org',
  requestedRails: ['eur', 'usd'],
  submitterPersonId: 10,
};

describe('signBankConfirmationJwt / verifyBankConfirmationJwt', () => {
  beforeEach(() => {
    process.env.INTERNAL_JWT_SECRET = 'test-secret-at-least-32-bytes-long!!';
  });

  it('round-trips the payload through sign + verify', async () => {
    const { token, nonce } = await signBankConfirmationJwt(payload);
    const result = await verifyBankConfirmationJwt(token);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.claims.jti).toBe(nonce);
      expect(result.claims.contactEmail).toBe('compliance@acme.org');
      expect(result.claims.ownerType).toBe('space');
      expect(result.claims.requestedRails).toEqual(['eur', 'usd']);
    }
  });

  it('produces a fresh nonce on every sign call', async () => {
    const first = await signBankConfirmationJwt(payload);
    const second = await signBankConfirmationJwt(payload);
    expect(first.nonce).not.toBe(second.nonce);
  });

  it('rejects a tampered token as invalid', async () => {
    const { token } = await signBankConfirmationJwt(payload);
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');

    const result = await verifyBankConfirmationJwt(tampered);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('invalid');
    }
  });

  it('rejects a token signed with a different secret', async () => {
    const { token } = await signBankConfirmationJwt(payload);
    process.env.INTERNAL_JWT_SECRET = 'a-completely-different-secret-value!!';

    const result = await verifyBankConfirmationJwt(token);
    expect(result.valid).toBe(false);
  });

  it('throws when INTERNAL_JWT_SECRET is unset', async () => {
    delete process.env.INTERNAL_JWT_SECRET;
    await expect(signBankConfirmationJwt(payload)).rejects.toThrow(
      'INTERNAL_JWT_SECRET',
    );
  });
});
