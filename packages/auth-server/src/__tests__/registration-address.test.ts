import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientAddress } from '../registration';

const req = (headers: Record<string, string>) =>
  new Request('http://auth.localhost:3000/api/auth/oauth2/register', {
    method: 'POST',
    headers,
  });

describe('clientAddress', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('outside Vercel every request is one address, whatever headers it sends', () => {
    vi.stubEnv('VERCEL', '');
    const spoof = {
      'x-real-ip': '203.0.113.9',
      'x-forwarded-for': '198.51.100.1',
      'x-vercel-forwarded-for': '192.0.2.5',
    };
    expect(clientAddress(req(spoof))).toBe('unknown');
    expect(clientAddress(req({}))).toBe('unknown');
  });

  it('on Vercel only the platform header counts', () => {
    vi.stubEnv('VERCEL', '1');
    const headers = {
      'x-vercel-forwarded-for': '192.0.2.5',
      'x-real-ip': '203.0.113.9',
      'x-forwarded-for': '198.51.100.1',
    };
    expect(clientAddress(req(headers))).toBe('192.0.2.5');
    expect(
      clientAddress(
        req({ 'x-forwarded-for': '198.51.100.1', 'x-real-ip': '203.0.113.9' }),
      ),
    ).toBe('unknown');
  });
});
