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

  it('does not leak claims in plaintext — encrypted (JWE), not just signed', async () => {
    const { token } = await signBankConfirmationJwt(payload);

    // A bare signed JWS would have a base64url-readable payload segment; decoding every segment
    // of this token without the key must not reveal any claim value.
    const segments = token.split('.');
    for (const segment of segments) {
      if (!segment) continue;
      const decoded = Buffer.from(segment, 'base64url').toString('utf8');
      expect(decoded).not.toContain(payload.contactEmail);
      expect(decoded).not.toContain(payload.legalName);
    }
  });

  it('produces a fresh nonce on every sign call', async () => {
    const first = await signBankConfirmationJwt(payload);
    const second = await signBankConfirmationJwt(payload);
    expect(first.nonce).not.toBe(second.nonce);
  });

  it('rejects a tampered token as invalid', async () => {
    const { token } = await signBankConfirmationJwt(payload);
    // Flip a character in the middle (ciphertext/IV), not the last one: the final base64url
    // character of a segment can carry unused padding bits, so flipping only that one
    // occasionally decodes to the same underlying bytes and doesn't actually corrupt anything.
    const mid = Math.floor(token.length / 2);
    const flipped = token[mid] === 'a' ? 'b' : 'a';
    const tampered = token.slice(0, mid) + flipped + token.slice(mid + 1);

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
