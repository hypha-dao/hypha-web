import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { assertStripeKeyMatchesRuntime } from '../stripe-env';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe('assertStripeKeyMatchesRuntime', () => {
  it('errors when production uses a test key', () => {
    process.env.VERCEL_ENV = 'production';
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    assertStripeKeyMatchesRuntime('rk_test_abc');

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('test-mode key but VERCEL_ENV=production'),
    );
  });

  it('warns when preview uses a live key', () => {
    process.env.VERCEL_ENV = 'preview';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    assertStripeKeyMatchesRuntime('sk_live_abc');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('live-mode key on a preview deploy'),
    );
  });
});
