/**
 * Registers a Stripe webhook endpoint against a deployment and stores its
 * signing secret on the Vercel project.
 *
 *   node scripts/stripe-webhook-endpoint.mjs                  # show the plan
 *   node scripts/stripe-webhook-endpoint.mjs --execute
 *   node scripts/stripe-webhook-endpoint.mjs --target production --execute
 *
 * Stripe returns the signing secret once, at creation, and never again. So the
 * secret is written straight to Vercel and never printed: there is no way to
 * recover it from a scrollback, and no reason to want one.
 *
 * By default this targets the branch's stable preview hostname rather than a
 * deployment URL, since a deployment URL stops existing at the next push and
 * the endpoint would go quietly dead.
 */
import { readFileSync } from 'node:fs';

import {
  PRODUCTION_URL,
  PREVIEW_URL,
  fromEnvFile,
  setEnv,
} from './lib/vercel.mjs';

/**
 * `checkout.session.completed` covers cards, which settle immediately.
 * `async_payment_succeeded` covers the delayed methods — BECS direct debit,
 * bank transfer — where the session completes well before the money lands.
 * `charge.refunded` reverses a grant.
 */
const EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'charge.refunded',
];

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const flag = args.indexOf('--target');
const target = flag === -1 ? 'preview' : args[flag + 1] ?? '';
if (!['preview', 'production'].includes(target)) {
  console.error(`--target must be preview or production, not ${target}`);
  process.exit(1);
}

const base = target === 'production' ? PRODUCTION_URL : PREVIEW_URL;
const endpointUrl = `${base}/api/webhooks/payments`;

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const secretKey = fromEnvFile(env, 'STRIPE_SECRET_KEY');
if (!secretKey) {
  console.error('STRIPE_SECRET_KEY is not set in .env.');
  process.exit(1);
}
if (/^(sk|rk)_live_/.test(secretKey)) {
  console.error('That is a live key. Refusing to wire a sandbox test to it.');
  process.exit(1);
}

async function stripe(path, { method = 'GET', form } = {}) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: form,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message ?? `${response.status} on ${path}`);
  }
  return json;
}

console.log(`Stripe webhook — ${execute ? 'applying' : 'dry run'}\n`);
console.log(`  target    ${target}`);
console.log(`  endpoint  ${endpointUrl}`);
console.log(`  events    ${EVENTS.join(', ')}\n`);

// The deployment must already answer, or the endpoint would be registered
// against a hostname that resolves to nothing.
const probe = await fetch(`${base}/api/campaign`).catch(() => null);
if (!probe?.ok) {
  console.error(
    `FAIL  ${base}/api/campaign did not answer (${
      probe?.status ?? 'no response'
    }).\n` + '      Deploy the branch before registering a webhook against it.',
  );
  process.exit(1);
}
console.log(`  deployment answers on ${base}\n`);

const { data: existing } = await stripe('/webhook_endpoints?limit=100');
const clashes = existing.filter((e) => e.url === endpointUrl);
for (const clash of clashes) {
  // Its secret is unrecoverable, so there is nothing to reuse — replacing it
  // is the only way to end up with a secret we can also give to Vercel.
  console.log(`  replace   ${clash.id} (${clash.status})`);
}
if (clashes.length === 0) console.log('  create    a new endpoint');

if (!execute) {
  console.log('\nRe-run with --execute to apply.');
  process.exit(0);
}

for (const clash of clashes) {
  await stripe(`/webhook_endpoints/${clash.id}`, { method: 'DELETE' });
}

const form = new URLSearchParams({
  url: endpointUrl,
  description: `Regen Sydney campaign — ${target}`,
});
for (const event of EVENTS) form.append('enabled_events[]', event);

const created = await stripe('/webhook_endpoints', { method: 'POST', form });
if (!created.secret) {
  console.error('Stripe created the endpoint but returned no signing secret.');
  process.exit(1);
}
console.log(`\n  created   ${created.id}`);

await setEnv('STRIPE_WEBHOOK_SECRET', created.secret, [target], {
  encrypted: true,
});
console.log(`  stored    STRIPE_WEBHOOK_SECRET on ${target} (value not shown)`);
console.log('\nRedeploy for it to take effect.');
