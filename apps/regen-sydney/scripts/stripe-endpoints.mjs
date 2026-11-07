/**
 * Lists, creates and removes Stripe webhook endpoints for the campaign.
 *
 *   node scripts/stripe-endpoints.mjs                        # list
 *   node scripts/stripe-endpoints.mjs create https://host    # create + save secret
 *   node scripts/stripe-endpoints.mjs delete we_123          # remove one
 *
 * `create` appends /api/webhooks/payments to the host you give it, subscribes
 * to the three events the campaign acts on, and writes the returned signing
 * secret into .env without printing it. That secret is only ever returned at
 * creation time, so it cannot be recovered later — a lost one means making a
 * new endpoint.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const envPath = new URL('../.env', import.meta.url);
const env = readFileSync(envPath, 'utf8');
const key = /^\s*STRIPE_SECRET_KEY\s*=\s*(.*)$/m.exec(env)?.[1]?.trim();

if (!key) {
  console.error('No STRIPE_SECRET_KEY in apps/regen-sydney/.env');
  process.exit(1);
}

const EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'charge.refunded',
];

async function stripe(method, path, body) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(body ? { body } : {}),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message ?? `${response.status}`);
  }
  return json;
}

const [command, argument] = process.argv.slice(2);

if (!command || command === 'list') {
  const { data } = await stripe('GET', 'webhook_endpoints?limit=20');
  if (!data.length) {
    console.log('No webhook endpoints on this account.');
  }
  for (const endpoint of data) {
    console.log(`${endpoint.id}  ${endpoint.status}`);
    console.log(`  ${endpoint.url}`);
    console.log(`  events: ${endpoint.enabled_events.join(', ')}`);
    if (endpoint.description) console.log(`  ${endpoint.description}`);
    console.log();
  }
  process.exit(0);
}

if (command === 'delete') {
  if (!argument) {
    console.error('Usage: node scripts/stripe-endpoints.mjs delete we_…');
    process.exit(1);
  }
  await stripe('DELETE', `webhook_endpoints/${argument}`);
  console.log(`Deleted ${argument}.`);
  process.exit(0);
}

if (command === 'create') {
  if (!argument) {
    console.error('Usage: node scripts/stripe-endpoints.mjs create https://host');
    process.exit(1);
  }
  const base = argument.replace(/\/+$/, '');
  const url = base.endsWith('/api/webhooks/payments')
    ? base
    : `${base}/api/webhooks/payments`;

  if (!url.startsWith('https://')) {
    console.error('Stripe only delivers to https. For localhost, use `stripe listen`.');
    process.exit(1);
  }

  const form = new URLSearchParams({
    url,
    description: 'Regen Sydney campaign — contributions',
  });
  EVENTS.forEach((event, index) => form.append(`enabled_events[${index}]`, event));

  const endpoint = await stripe('POST', 'webhook_endpoints', form);
  console.log(`Created ${endpoint.id}`);
  console.log(`  ${endpoint.url}`);
  console.log(`  events: ${EVENTS.join(', ')}`);

  const secret = endpoint.secret;
  if (!secret) {
    console.log('\nNo signing secret returned — set STRIPE_WEBHOOK_SECRET by hand.');
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
    `\nSigning secret written to .env (whsec_…${secret.slice(-4)}). Stripe never shows it again.`,
  );
  console.log('Set the same value as STRIPE_WEBHOOK_SECRET wherever the app is deployed.');
  process.exit(0);
}

console.error(`Unknown command "${command}". Use list, create or delete.`);
process.exit(1);
