import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildBankingKycRedirectUri } from '../build-banking-redirect-uri';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function clearOrigin() {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL_ENV;
}

const PATH = '/en/dho/acme/treasury?tab=bank-accounts&banking=return';

describe('buildBankingKycRedirectUri', () => {
  it('uses the canonical origin on production, not the per-deployment host', () => {
    clearOrigin();
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_URL = 'hypha-abc123-hypha-dao.vercel.app';
    expect(buildBankingKycRedirectUri('en', 'acme')).toBe(
      `https://app.hypha.earth${PATH}`,
    );
  });

  it('honours NEXT_PUBLIC_APP_URL even when VERCEL_URL is set', () => {
    clearOrigin();
    process.env.NEXT_PUBLIC_APP_URL = 'https://pr-1.preview-app.hypha.earth/';
    process.env.VERCEL_URL = 'hypha-abc123-hypha-dao.vercel.app';
    process.env.VERCEL_ENV = 'preview';
    expect(buildBankingKycRedirectUri('en', 'acme')).toBe(
      `https://pr-1.preview-app.hypha.earth${PATH}`,
    );
  });

  it('falls back to the deployment host on a preview without NEXT_PUBLIC_APP_URL', () => {
    clearOrigin();
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_URL = 'my-preview.vercel.app';
    expect(buildBankingKycRedirectUri('en', 'acme')).toBe(
      `https://my-preview.vercel.app${PATH}`,
    );
  });

  it('returns localhost when nothing is configured (local dev)', () => {
    clearOrigin();
    expect(buildBankingKycRedirectUri('en', 'acme')).toBe(
      `http://localhost:3000${PATH}`,
    );
  });
});
