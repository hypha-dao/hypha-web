import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  getAbsoluteAppUrl,
  getAppBaseUrl,
  getSpaceBankingRedirectUrl,
} from '../get-app-url';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getAppBaseUrl', () => {
  it('uses NEXT_PUBLIC_APP_URL when set', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000/';
    delete process.env.VERCEL_URL;
    expect(getAppBaseUrl()).toBe('http://localhost:3000');
  });

  it('falls back to https VERCEL_URL', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_URL = 'my-preview.vercel.app';
    expect(getAppBaseUrl()).toBe('https://my-preview.vercel.app');
  });

  it('defaults to production app origin', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    expect(getAppBaseUrl()).toBe('https://app.hypha.earth');
  });
});

describe('getSpaceBankingRedirectUrl', () => {
  it('builds locale-prefixed banking path on the app origin', () => {
    expect(
      getSpaceBankingRedirectUrl('acme', {
        baseUrl: 'https://app.hypha.earth',
      }),
    ).toBe('https://app.hypha.earth/en/dho/acme/banking');
  });
});

describe('getAbsoluteAppUrl', () => {
  it('joins base and path without duplicate slashes', () => {
    expect(
      getAbsoluteAppUrl('/en/dho/acme/banking', 'https://app.hypha.earth/'),
    ).toBe('https://app.hypha.earth/en/dho/acme/banking');
  });
});
