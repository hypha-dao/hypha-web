/**
 * Fetches the Stripe CLI's webhook signing secret and writes it into .env.
 *
 *   node scripts/stripe-webhook-secret.mjs
 *
 * `stripe listen --print-secret` would put the secret on stdout, where it ends
 * up in scrollback and terminal logs. This captures it instead and reports only
 * a masked confirmation.
 *
 * The secret belongs to the CLI's forwarding session, so it stays valid across
 * restarts of `stripe listen` for the same account.
 */
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';

const run = promisify(execFile);
const envPath = new URL('../.env', import.meta.url);

const env = readFileSync(envPath, 'utf8');
const apiKey = /^\s*STRIPE_SECRET_KEY\s*=\s*(.*)$/m.exec(env)?.[1]?.trim();

if (!apiKey) {
  console.error('No STRIPE_SECRET_KEY in .env');
  process.exit(1);
}

let stdout;
try {
  ({ stdout } = await run(
    'stripe',
    ['listen', '--api-key', apiKey, '--print-secret'],
    { timeout: 30_000 },
  ));
} catch (error) {
  const detail = (error.stderr || error.stdout || error.message)
    .toString()
    .replace(/(rk|sk)_(test|live)_[A-Za-z0-9]+/g, '$1_$2_<redacted>')
    .trim();
  console.error('stripe listen failed:\n  ' + detail.split('\n').join('\n  '));
  process.exit(1);
}

const secret = /whsec_[A-Za-z0-9]+/.exec(stdout)?.[0];
if (!secret) {
  console.error('No whsec_… in the CLI output — is the key allowed to manage webhooks?');
  process.exit(1);
}

const line = `STRIPE_WEBHOOK_SECRET=${secret}`;
writeFileSync(
  envPath,
  /^STRIPE_WEBHOOK_SECRET=.*$/m.test(env)
    ? env.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, line)
    : `${env.replace(/\n*$/, '\n')}${line}\n`,
);

console.log(
  `Wrote STRIPE_WEBHOOK_SECRET to .env (whsec_…${secret.slice(-4)}, ${secret.length} chars).`,
);
console.log('\nNow run, in a terminal of its own:');
console.log('  stripe listen --forward-to localhost:3002/api/webhooks/payments');
