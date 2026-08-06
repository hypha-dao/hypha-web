/**
 * Pushes the campaign's configuration to the regen-sydney Vercel project.
 *
 *   node scripts/vercel-env-set.mjs            # show what would change
 *   node scripts/vercel-env-set.mjs --execute
 *
 * Only settings this repo can determine on its own are handled here. Two are
 * deliberately left out, because each is a decision rather than a value:
 *
 *   PRIVY_APP_SECRET          held encrypted on the hypha-web project
 *   RSUT_RELAYER_PRIVATE_KEY  mint authority over a real token; putting it in
 *                             preview would let any preview deploy mint RSUT
 *
 * The database connection is not here either, but for a different reason: the
 * Neon integration publishes it as CAMPAIGN_DB_DATABASE_URL and keeps it in
 * sync. Nothing to push.
 *
 * Values for the Stripe and campaign settings are read from the local .env, so
 * what is deployed matches what was tested.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const TEAM = 'team_YAelhta9tYGFYAu3jPN1TE5v';
const PROJECT = 'regen-sydney';
const PRODUCTION_URL = 'https://regen-sydney.vercel.app';

const execute = process.argv.includes('--execute');

const local = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const fromLocal = (name) =>
  new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`, 'm')
    .exec(local)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, '') || '';

/** Anything not listed here is intentionally left for a human to decide. */
const desired = {
  NEXT_PUBLIC_PRIVY_APP_ID: fromLocal('NEXT_PUBLIC_PRIVY_APP_ID'),
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
  NEXT_PUBLIC_APP_URL: PRODUCTION_URL,
  HYPHA_BASE_URL: fromLocal('HYPHA_BASE_URL') || 'https://app.hypha.earth',
};

/** Values that must never reach a deployment by accident. */
const secretish = new Set(['STRIPE_SECRET_KEY']);

for (const [key, value] of Object.entries(desired)) {
  if (!value) {
    console.error(`${key} is empty in .env — fill it in first.`);
    process.exit(1);
  }
}
if (/^(sk|rk)_live_/.test(desired.STRIPE_SECRET_KEY)) {
  console.error('STRIPE_SECRET_KEY is a live key. Refusing to deploy it from a test setup.');
  process.exit(1);
}

let token;
for (const path of [
  join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json'),
  join(homedir(), '.local/share/com.vercel.cli/auth.json'),
]) {
  try {
    token = JSON.parse(readFileSync(path, 'utf8')).token;
    if (token) break;
  } catch {
    // next
  }
}
if (!token) {
  console.error('No Vercel CLI token — run `vercel login`.');
  process.exit(1);
}

async function api(path, init = {}) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message ?? `${response.status} on ${path}`);
  return json;
}

const TARGETS = ['production', 'preview', 'development'];
const { envs } = await api(`/v10/projects/${PROJECT}/env?teamId=${TEAM}`);

console.log(`${PROJECT} — ${execute ? 'applying' : 'dry run'}\n`);

for (const [key, value] of Object.entries(desired)) {
  const existing = envs.filter((e) => e.key === key);
  const shown = secretish.has(key) ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;

  if (!execute) {
    console.log(`  ${existing.length ? 'replace' : 'create '}  ${key} = ${shown}`);
    continue;
  }

  for (const entry of existing) {
    await api(`/v9/projects/${PROJECT}/env/${entry.id}?teamId=${TEAM}`, {
      method: 'DELETE',
    });
  }

  await api(`/v10/projects/${PROJECT}/env?teamId=${TEAM}&upsert=true`, {
    method: 'POST',
    body: JSON.stringify({
      key,
      value,
      type: secretish.has(key) ? 'encrypted' : 'plain',
      target: TARGETS,
    }),
  });
  console.log(`  set      ${key} = ${shown}`);
}

console.log('\nStill unset, on purpose:');
console.log('  PRIVY_APP_SECRET          copy from the hypha-web project');
console.log('  STRIPE_WEBHOOK_SECRET     created with the webhook endpoint');
console.log('  RSUT_RELAYER_PRIVATE_KEY  mint authority — production only, once you are ready');

if (!execute) console.log('\nRe-run with --execute to apply.');
