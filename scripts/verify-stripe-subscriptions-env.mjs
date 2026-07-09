#!/usr/bin/env node
/**
 * Validates Stripe subscription env for Preview (test) or Production (live).
 *
 * Usage:
 *   node scripts/verify-stripe-subscriptions-env.mjs preview
 *   node scripts/verify-stripe-subscriptions-env.mjs production
 *
 * Reads apps/web/.env by default. Pass STRIPE_ENV_FILE to override.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = process.argv[2] ?? 'preview';
if (target !== 'preview' && target !== 'production') {
  console.error('Usage: node scripts/verify-stripe-subscriptions-env.mjs <preview|production>');
  process.exit(1);
}

const envPath = process.env.STRIPE_ENV_FILE
  ? resolve(process.env.STRIPE_ENV_FILE)
  : resolve('apps/web/.env');

function parseEnvFile(path) {
  const text = readFileSync(path, 'utf8');
  const vars = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

function keyMode(value) {
  if (!value) return 'missing';
  if (/_test_/.test(value)) return 'test';
  if (/_live_/.test(value)) return 'live';
  return 'unknown';
}

function appOrigin(vars) {
  if (vars.NEXT_PUBLIC_APP_URL?.trim()) {
    return vars.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (target === 'production') return 'https://app.hypha.earth';
  return '(preview — set NEXT_PUBLIC_APP_URL or rely on pr-<n>.preview-app.hypha.earth)';
}

let vars;
try {
  vars = parseEnvFile(envPath);
} catch (error) {
  console.error(`Could not read ${envPath}:`, error.message);
  process.exit(1);
}

const required = [
  'NEXT_PUBLIC_ENABLE_STRIPE_SUBSCRIPTIONS',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_SPACE_MONTHLY',
  'SUBSCRIPTION_PAYER_PRIVATE_KEY',
];

const missing = required.filter((name) => !vars[name]?.trim());
const stripeMode = keyMode(vars.STRIPE_SECRET_KEY);
const webhookMode = keyMode(vars.STRIPE_WEBHOOK_SECRET);
const origin = appOrigin(vars);
const webhookUrl = `${origin.replace(/\/$/, '')}/api/webhooks/stripe`;

console.log(`\nStripe subscriptions env check (${target})`);
console.log(`File: ${envPath}\n`);

if (missing.length) {
  console.log('Missing:');
  for (const name of missing) console.log(`  - ${name}`);
} else {
  console.log('Required variables: present');
}

console.log(`Feature flag: ${vars.NEXT_PUBLIC_ENABLE_STRIPE_SUBSCRIPTIONS}`);
console.log(`Stripe secret key mode: ${stripeMode}`);
console.log(`Webhook secret mode: ${webhookMode}`);
console.log(`Checkout/portal return origin: ${origin}`);
console.log(`Webhook endpoint (register in Stripe ${target === 'production' ? 'Live' : 'Test'} mode):`);
console.log(`  ${webhookUrl}`);
console.log(
  '\nStripe Dashboard → Webhooks → events: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted',
);
console.log(
  'Stripe Dashboard → Settings → Billing → Customer portal: enable subscription cancellation.',
);

let ok = missing.length === 0;
if (target === 'production') {
  if (stripeMode !== 'live') {
    console.error('\nProduction requires live Stripe secret key (sk_live_/rk_live_).');
    ok = false;
  }
  if (webhookMode === 'test') {
    console.error('Production webhook secret looks like test mode (whsec_ from test endpoint).');
    ok = false;
  }
  if (vars.NEXT_PUBLIC_ENABLE_STRIPE_SUBSCRIPTIONS !== 'true') {
    console.error('NEXT_PUBLIC_ENABLE_STRIPE_SUBSCRIPTIONS must be true (rebuild after change).');
    ok = false;
  }
} else if (stripeMode === 'live') {
  console.warn('\nPreview/sandbox should use test keys, not live.');
}

console.log(ok ? '\nOK' : '\nFAILED');
process.exit(ok ? 0 : 1);
