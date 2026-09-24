import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getAbsoluteAppUrl, getAppBaseUrl } from '../get-app-url';

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

  it('falls back to https VERCEL_URL on a preview deployment', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_URL = 'my-preview.vercel.app';
    expect(getAppBaseUrl()).toBe('https://my-preview.vercel.app');
  });

  it('ignores the per-deployment VERCEL_URL on production and uses the canonical origin', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_URL = 'hypha-abc123-hypha-dao.vercel.app';
    expect(getAppBaseUrl()).toBe('https://app.hypha.earth');
  });

  it('still honours NEXT_PUBLIC_APP_URL on production', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.org/';
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_URL = 'hypha-abc123-hypha-dao.vercel.app';
    expect(getAppBaseUrl()).toBe('https://app.example.org');
  });

  it('defaults to production app origin', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    expect(getAppBaseUrl()).toBe('https://app.hypha.earth');
  });
});

describe('getAbsoluteAppUrl', () => {
  it('joins base and path without duplicate slashes', () => {
    expect(
      getAbsoluteAppUrl('/en/dho/acme/banking', 'https://app.hypha.earth/'),
    ).toBe('https://app.hypha.earth/en/dho/acme/banking');
  });
});
