import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  extractHsToken,
  verifyHsToken,
  HsTokenError,
} from '../verify-hs-token';

describe('extractHsToken', () => {
  it('reads a Bearer Authorization header', () => {
    const headers = new Headers({ authorization: 'Bearer secret-abc' });
    expect(extractHsToken(headers, new URLSearchParams())).toBe('secret-abc');
  });

  it('falls back to the legacy ?access_token= query param', () => {
    const headers = new Headers();
    const params = new URLSearchParams({ access_token: 'secret-xyz' });
    expect(extractHsToken(headers, params)).toBe('secret-xyz');
  });

  it('prefers the header over the query param', () => {
    const headers = new Headers({ authorization: 'Bearer from-header' });
    const params = new URLSearchParams({ access_token: 'from-query' });
    expect(extractHsToken(headers, params)).toBe('from-header');
  });

  it('returns null when neither is present', () => {
    expect(extractHsToken(new Headers(), new URLSearchParams())).toBeNull();
  });
});

describe('verifyHsToken', () => {
  const ORIGINAL = process.env.HYPHA_MATRIX_AS_HS_TOKEN;

  beforeEach(() => {
    process.env.HYPHA_MATRIX_AS_HS_TOKEN = 'the-real-token';
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.HYPHA_MATRIX_AS_HS_TOKEN;
    else process.env.HYPHA_MATRIX_AS_HS_TOKEN = ORIGINAL;
  });

  it('passes for the exact configured token', () => {
    expect(() => verifyHsToken('the-real-token')).not.toThrow();
  });

  it('throws 403 for a wrong token of the same length', () => {
    try {
      verifyHsToken('the-fake-token');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HsTokenError);
      expect((error as HsTokenError).status).toBe(403);
      expect((error as HsTokenError).errcode).toBe('M_FORBIDDEN');
    }
  });

  it('throws 403 for a missing token', () => {
    expect(() => verifyHsToken(null)).toThrow(HsTokenError);
    try {
      verifyHsToken(null);
    } catch (error) {
      expect((error as HsTokenError).status).toBe(403);
    }
  });

  it('throws 503 when the secret is not configured', () => {
    delete process.env.HYPHA_MATRIX_AS_HS_TOKEN;
    try {
      verifyHsToken('anything');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HsTokenError);
      expect((error as HsTokenError).status).toBe(503);
    }
  });
});
