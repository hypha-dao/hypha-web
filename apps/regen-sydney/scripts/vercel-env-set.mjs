/**
 * Pushes the campaign's configuration to the regen-sydney Vercel project.
 *
 *   node scripts/vercel-env-set.mjs            # show what would change
 *   node scripts/vercel-env-set.mjs --execute
 *
 * Values are read from the local .env, so what is deployed matches what was
 * tested. Two settings are deliberately left out:
 *
 *   STRIPE_WEBHOOK_SECRET     comes into existence with the webhook endpoint —
 *                             see scripts/stripe-webhook-endpoint.mjs
 *   RSUT_RELAYER_PRIVATE_KEY  mint authority over a real token; putting it in
 *                             preview would let any preview deploy mint RSUT
 *
 * The database connection is not here either, but for a different reason: the
 * Neon integration publishes it as CAMPAIGN_DB_DATABASE_URL and keeps it in
 * sync. Nothing to push.
 */
import { readFileSync } from 'node:fs';

import {
  PROJECT,
  PRODUCTION_URL,
  TEAM,
  PREVIEW_URL,
  fromEnvFile,
  vercel,
} from './lib/vercel.mjs';

const execute = process.argv.includes('--execute');

const local = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const fromLocal = (name) => fromEnvFile(local, name);

const ALL = ['production', 'preview', 'development'];

/**
 * A plain string applies to every target. An object names the targets it
 * applies to and gives each its own value — which is what NEXT_PUBLIC_APP_URL
 * needs, since a preview that advertises the production hostname sends anyone
 * returning from Stripe Checkout to the wrong deployment.
 */
const desired = {
  NEXT_PUBLIC_PRIVY_APP_ID: fromLocal('NEXT_PUBLIC_PRIVY_APP_ID'),
  PRIVY_APP_SECRET: {
    production: fromLocal('PRIVY_APP_SECRET'),
    preview: fromLocal('PRIVY_APP_SECRET'),
  },
  CAMPAIGN_ADMIN_EMAILS: fromLocal('CAMPAIGN_ADMIN_EMAILS'),
  CAMPAIGN_JOIN_BONUS_RSUT: fromLocal('CAMPAIGN_JOIN_BONUS_RSUT'),
  CAMPAIGN_RSUT_PER_AUD: fromLocal('CAMPAIGN_RSUT_PER_AUD'),
  CAMPAIGN_MIN_CONTRIBUTION_AUD: fromLocal('CAMPAIGN_MIN_CONTRIBUTION_AUD'),
  CAMPAIGN_MAX_CONTRIBUTION_AUD: fromLocal('CAMPAIGN_MAX_CONTRIBUTION_AUD'),
  RSUT_TOKEN_ADDRESS: fromLocal('RSUT_TOKEN_ADDRESS'),
  RSUT_CHAIN_ID: fromLocal('RSUT_CHAIN_ID'),
  RPC_URL: 'https://base-rpc.publicnode.com',
  CAMPAIGN_PAYMENTS_PROVIDER: 'stripe',
  STRIPE_SECRET_KEY: fromLocal('STRIPE_SECRET_KEY'),
  NEXT_PUBLIC_APP_URL: {
    production: PRODUCTION_URL,
    preview: PREVIEW_URL,
    development: 'http://localhost:3002',
  },
  HYPHA_BASE_URL: fromLocal('HYPHA_BASE_URL') || 'https://app.hypha.earth',
};

/** Values that must never be echoed, here or into a deployment log. */
const secretish = new Set(['STRIPE_SECRET_KEY', 'PRIVY_APP_SECRET']);

/** Normalises both spellings into { target: value } pairs. */
const spread = (value) =>
  typeof value === 'string'
    ? Object.fromEntries(ALL.map((target) => [target, value]))
    : value;

for (const [key, value] of Object.entries(desired)) {
  for (const [target, each] of Object.entries(spread(value))) {
    if (!each) {
      console.error(`${key} (${target}) is empty in .env — fill it in first.`);
      process.exit(1);
    }
  }
}
if (/^(sk|rk)_live_/.test(desired.STRIPE_SECRET_KEY)) {
  console.error(
    'STRIPE_SECRET_KEY is a live key. Refusing to deploy it from a test setup.',
  );
  process.exit(1);
}

const { envs } = await vercel(`/v10/projects/${PROJECT}/env?teamId=${TEAM}`);

console.log(`${PROJECT} — ${execute ? 'applying' : 'dry run'}\n`);

for (const [key, value] of Object.entries(desired)) {
  const byTarget = spread(value);
  const existing = envs.filter((e) => e.key === key);

  // One entry per distinct value, so targets sharing a value stay one row.
  const groups = new Map();
  for (const [target, each] of Object.entries(byTarget)) {
    groups.set(each, [...(groups.get(each) ?? []), target]);
  }

  if (execute) {
    for (const entry of existing) {
      await vercel(`/v9/projects/${PROJECT}/env/${entry.id}?teamId=${TEAM}`, {
        method: 'DELETE',
      });
    }
  }

  for (const [each, targets] of groups) {
    const shown = secretish.has(key)
      ? `${each.slice(0, 8)}…${each.slice(-4)}`
      : each;
    const scope =
      targets.length === ALL.length ? '' : ` [${targets.join(', ')}]`;

    if (!execute) {
      console.log(
        `  ${
          existing.length ? 'replace' : 'create '
        }  ${key} = ${shown}${scope}`,
      );
      continue;
    }

    await vercel(`/v10/projects/${PROJECT}/env?teamId=${TEAM}`, {
      method: 'POST',
      body: JSON.stringify({
        key,
        value: each,
        type: secretish.has(key) ? 'encrypted' : 'plain',
        target: targets,
      }),
    });
    console.log(`  set      ${key} = ${shown}${scope}`);
  }
}

console.log('\nStill unset, on purpose:');
console.log('  STRIPE_WEBHOOK_SECRET     scripts/stripe-webhook-endpoint.mjs');
console.log(
  '  RSUT_RELAYER_PRIVATE_KEY  mint authority — production only, once you are ready',
);

if (!execute) console.log('\nRe-run with --execute to apply.');
