import 'server-only';

type StripeKeyMode = 'test' | 'live' | 'unknown';

function detectStripeKeyMode(secretKey: string): StripeKeyMode {
  if (/_test_/.test(secretKey)) return 'test';
  if (/_live_/.test(secretKey)) return 'live';
  return 'unknown';
}

/**
 * Ensures Stripe keys match the Vercel runtime. Preview/sandbox uses test
 * keys; production must use live keys. Logs loudly but does not throw so a
 * misconfigured deploy is visible without taking down unrelated routes.
 */
export function assertStripeKeyMatchesRuntime(secretKey: string): void {
  const mode = detectStripeKeyMode(secretKey);
  const vercelEnv = process.env.VERCEL_ENV;

  if (vercelEnv === 'production' && mode === 'test') {
    console.error(
      '[stripe] STRIPE_SECRET_KEY is a test-mode key but VERCEL_ENV=production. ' +
        'Set live keys (sk_live_/rk_live_) on the Vercel Production environment.',
    );
    return;
  }

  if (vercelEnv === 'preview' && mode === 'live') {
    console.warn(
      '[stripe] STRIPE_SECRET_KEY is a live-mode key on a preview deploy. ' +
        'Use test keys on Preview and live keys only on Production.',
    );
  }
}
