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

  it('falls back to https VERCEL_URL', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_GIT_PULL_REQUEST_ID;
    process.env.VERCEL_URL = 'my-preview.vercel.app';
    expect(getAppBaseUrl()).toBe('https://my-preview.vercel.app');
  });

  it('uses the public app domain on Vercel production', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_URL = 'hypha-web-abc.vercel.app';
    expect(getAppBaseUrl()).toBe('https://app.hypha.earth');
  });

  it('uses the deterministic PR preview alias on Vercel preview', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_GIT_PULL_REQUEST_ID = '2368';
    process.env.VERCEL_URL = 'hypha-web-git-feat-stripe.vercel.app';
    expect(getAppBaseUrl()).toBe('https://pr-2368.preview-app.hypha.earth');
  });

  it('defaults to production app origin', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_GIT_PULL_REQUEST_ID;
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
