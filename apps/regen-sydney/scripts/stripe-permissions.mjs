/**
 * Reports which Stripe permissions the configured key actually carries.
 *
 * Restricted keys (rk_…) are scoped per resource, and Stripe has no endpoint
 * that lists a key's grants — the only way to find out is to try. Each probe
 * below is a read or a harmless create, and a 403 means the scope is missing
 * rather than that anything is broken.
 */
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const key = /^\s*STRIPE_SECRET_KEY\s*=\s*(.*)$/m.exec(env)?.[1]?.trim();

if (!key) {
  console.error('No STRIPE_SECRET_KEY in apps/regen-sydney/.env');
  process.exit(1);
}

console.log(`key type   ${key.slice(0, key.indexOf('_', 3) + 1)}…`);
console.log(`mode       ${key.includes('_test_') ? 'test (sandbox)' : 'LIVE'}\n`);

async function probe(label, method, path, body) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(body ? { body } : {}),
  });
  const json = await response.json().catch(() => ({}));

  if (response.ok) {
    console.log(`  yes  ${label}`);
    return json;
  }
  const message = json.error?.message ?? `${response.status}`;
  const scoped = response.status === 403;
  console.log(`  ${scoped ? 'no ' : '?? '} ${label}`);
  console.log(`         ${message.slice(0, 150)}`);
  return null;
}

console.log('Permissions');
await probe('read account', 'GET', 'account');
await probe('read balance', 'GET', 'balance');
await probe('read products', 'GET', 'products?limit=1');
await probe('read checkout sessions', 'GET', 'checkout/sessions?limit=1');
await probe('read payment intents', 'GET', 'payment_intents?limit=1');
await probe('read webhook endpoints', 'GET', 'webhook_endpoints?limit=1');

console.log('\nWrites the campaign needs');
const session = await probe(
  'create a checkout session',
  'POST',
  'checkout/sessions',
  new URLSearchParams({
    mode: 'payment',
    success_url: 'https://example.org/ok',
    cancel_url: 'https://example.org/no',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'aud',
    'line_items[0][price_data][unit_amount]': '500',
    'line_items[0][price_data][product_data][name]': 'permission probe',
  }),
);
if (session?.id) {
  console.log(`         created ${session.id}, expiring on its own`);
}

console.log('\nWrites that would let me finish the setup unaided');
await probe(
  'create a webhook endpoint',
  'POST',
  'webhook_endpoints',
  new URLSearchParams({
    url: 'https://example.org/api/webhooks/payments',
    'enabled_events[0]': 'checkout.session.completed',
    description: 'permission probe — safe to delete',
  }),
);
