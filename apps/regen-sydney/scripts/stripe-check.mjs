/**
 * Checks that the Stripe sandbox is wired up correctly before anyone tries a
 * real contribution.
 *
 *   node scripts/stripe-check.mjs
 *
 * Reads STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET from .env, confirms the key
 * works and is a test key, opens a throwaway A$25 Checkout Session against the
 * live API, and replays a signed webhook at the local app so the whole
 * contribute → grant → mint path is exercised without touching a card.
 */
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

for (const file of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // absent file is fine
  }
}

const secretKey = process.env.STRIPE_SECRET_KEY ?? '';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002';
const personId = process.argv[2] ?? '1';

let failed = false;
const pass = (m) => console.log(`  ok    ${m}`);
const fail = (m) => {
  failed = true;
  console.log(`  FAIL  ${m}`);
};

console.log('Configuration');
if (!secretKey) fail('STRIPE_SECRET_KEY is not set');
else if (secretKey.startsWith('sk_test_')) pass('STRIPE_SECRET_KEY is a test key');
else if (secretKey.startsWith('sk_live_'))
  fail('STRIPE_SECRET_KEY is a LIVE key — use a test key for the sandbox');
else fail(`STRIPE_SECRET_KEY has an unexpected prefix (${secretKey.slice(0, 8)}…)`);

if (!webhookSecret) fail('STRIPE_WEBHOOK_SECRET is not set');
else if (webhookSecret.startsWith('whsec_')) pass('STRIPE_WEBHOOK_SECRET looks right');
else fail('STRIPE_WEBHOOK_SECRET should start with whsec_');

if (process.env.CAMPAIGN_PAYMENTS_PROVIDER === 'stripe')
  pass('CAMPAIGN_PAYMENTS_PROVIDER=stripe');
else
  fail(
    `CAMPAIGN_PAYMENTS_PROVIDER is "${process.env.CAMPAIGN_PAYMENTS_PROVIDER ?? 'unset'}" — set it to stripe`,
  );

if (failed) {
  console.log('\nFix the above and re-run.');
  process.exit(1);
}

async function stripe(path, body, extraHeaders = {}) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...extraHeaders,
    },
    ...(body ? { body } : {}),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status} ${json.error?.message ?? JSON.stringify(json)}`);
  }
  return json;
}

console.log('\nStripe API');
const account = await stripe('account');
pass(`authenticated as ${account.settings?.dashboard?.display_name ?? account.id} (${account.id})`);
if (account.charges_enabled) pass('charges enabled');
else console.log('  note  charges are not enabled — fine for a sandbox');

const reference = `rs_${personId}_check_${Date.now().toString(36)}`;
const form = new URLSearchParams({
  mode: 'payment',
  success_url: `${appUrl}/?contribution=success`,
  cancel_url: `${appUrl}/?contribution=cancelled`,
  client_reference_id: reference,
  'metadata[reference]': reference,
  'metadata[personId]': personId,
  'line_items[0][quantity]': '1',
  'line_items[0][price_data][currency]': 'aud',
  'line_items[0][price_data][unit_amount]': '2500',
  'line_items[0][price_data][product_data][name]':
    'Regen Sydney community fund contribution',
  submit_type: 'donate',
});
const session = await stripe('checkout/sessions', form, { 'Idempotency-Key': reference });
pass(`created checkout session ${session.id}`);
console.log(`        ${session.url}`);

console.log('\nWebhook replay against the local app');
const payload = JSON.stringify({
  id: `evt_check_${Date.now()}`,
  type: 'checkout.session.completed',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: session.id,
      object: 'checkout.session',
      amount_total: 2500,
      currency: 'aud',
      payment_status: 'paid',
      client_reference_id: reference,
      metadata: { reference, personId },
      customer_details: { email: null },
    },
  },
});
const timestamp = Math.floor(Date.now() / 1000);
const signature = createHmac('sha256', webhookSecret)
  .update(`${timestamp}.${payload}`, 'utf8')
  .digest('hex');

const endpoint = `${appUrl}/api/webhooks/payments`;
let response;
try {
  response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': `t=${timestamp},v1=${signature}`,
    },
    body: payload,
  });
} catch (error) {
  fail(`could not reach ${endpoint} — is the dev server running? (${error.message})`);
  process.exit(1);
}

const text = await response.text();
if (response.ok) pass(`${endpoint} → ${response.status} ${text}`);
else fail(`${endpoint} → ${response.status} ${text}`);

console.log('\nAnd the signature check itself rejects a tampered body:');
const tampered = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Stripe-Signature': `t=${timestamp},v1=${signature}`,
  },
  body: payload.replace('2500', '250000'),
});
if (tampered.status === 400) pass(`rejected with ${tampered.status}`);
else fail(`expected 400, got ${tampered.status} — signatures are not being enforced`);

console.log(
  failed
    ? '\nSomething is off — see the failures above.'
    : `\nSandbox is connected. Pay the session above with card 4242 4242 4242 4242 to see a real webhook.`,
);
process.exit(failed ? 1 : 0);
