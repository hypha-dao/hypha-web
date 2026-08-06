/**
 * Confirms the campaign is pointed at its own database, and only its own.
 *
 *   node scripts/db-check.mjs                  # reads .env
 *   node scripts/db-check.mjs .env.production  # or a pulled Vercel env file
 *
 * Run this before any deploy that changes the database wiring. It answers one
 * question — "could this connection reach the Hypha platform?" — by looking at
 * what is actually in the database rather than trusting the variable name:
 *
 *   - Hypha's tables (people, spaces, documents…) must be absent. Their
 *     presence means CAMPAIGN_DB_URL is pointed at a platform database, which
 *     is the failure this whole arrangement exists to prevent.
 *   - The campaign's own tables should be present, so migrations have run.
 *
 * Everything here is a read. Nothing is created, altered or dropped, and the
 * connection string is never printed — only its host and database name.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { neonConfig, Pool } from '@neondatabase/serverless';
import { WebSocket } from 'ws';

const envFile = process.argv[2] ?? '.env';

function readEnv(path) {
  let text;
  try {
    text = readFileSync(resolve(path), 'utf8');
  } catch {
    return {};
  }
  const values = {};
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

const fromFile = readEnv(envFile);
const connectionString =
  process.env.CAMPAIGN_DB_URL || fromFile.CAMPAIGN_DB_URL || '';

if (!connectionString) {
  console.error(`No CAMPAIGN_DB_URL in the environment or in ${envFile}.`);
  process.exit(1);
}

/** If any of these exist, we are looking at a Hypha database, not ours. */
const HYPHA_TABLES = [
  'people',
  'spaces',
  'documents',
  'memberships',
  'tokens',
  'space_api_keys',
];

const CAMPAIGN_TABLES = [
  'campaign_members',
  'campaign_projects',
  'campaign_cycles',
  'campaign_grants',
  'campaign_votes',
  'campaign_payouts',
];

/** The same comparison the app makes at startup, done here before deploying. */
const HYPHA_DB_VARS = [
  'DEFAULT_DB_URL',
  'BRANCH_DB_URL',
  'DEFAULT_DB_AUTHENTICATED_URL',
  'DEFAULT_DB_ANONYMOUS_URL',
];

for (const name of HYPHA_DB_VARS) {
  const other = process.env[name] || fromFile[name];
  if (other && other === connectionString) {
    console.error(
      `FAIL  CAMPAIGN_DB_URL is the same connection string as ${name}.\n` +
        '      Point the campaign at its own Neon project before deploying.',
    );
    process.exit(1);
  }
}

if (connectionString.includes('localhost')) {
  neonConfig.wsProxy = (host) => `${host}:5433/v1`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
} else {
  neonConfig.webSocketConstructor = WebSocket;
  neonConfig.poolQueryViaFetch = true;
}

const url = new URL(connectionString);
console.log(`Campaign database: ${url.hostname}${url.pathname}\n`);

const pool = new Pool({ connectionString });
let failed = false;

try {
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [[...HYPHA_TABLES, ...CAMPAIGN_TABLES]],
  );
  const present = new Set(rows.map((r) => r.table_name));

  const intruders = HYPHA_TABLES.filter((t) => present.has(t));
  if (intruders.length > 0) {
    failed = true;
    console.log('Hypha platform tables found in this database:');
    for (const table of intruders) console.log(`  !!  ${table}`);
    console.log(
      '\nFAIL  This looks like a Hypha database. The campaign must have its own —\n' +
        '      nothing here should be able to touch the platform.',
    );
  } else {
    console.log('No Hypha platform tables here — good, this database is ours alone.');
  }

  console.log('\nCampaign tables:');
  const missing = [];
  for (const table of CAMPAIGN_TABLES) {
    const ok = present.has(table);
    if (!ok) missing.push(table);
    console.log(`  ${ok ? 'yes' : 'NO '}  ${table}`);
  }

  if (missing.length > 0 && !failed) {
    console.log(
      '\nMigrations have not been applied. Run:\n' +
        '  pnpm --filter regen-sydney db:migrate',
    );
    failed = true;
  }

  if (!failed) {
    const counts = await pool.query(`
      SELECT
        (SELECT count(*) FROM campaign_members)  AS members,
        (SELECT count(*) FROM campaign_projects) AS projects,
        (SELECT count(*) FROM campaign_grants)   AS grants,
        (SELECT count(*) FROM campaign_cycles WHERE status = 'open') AS open_rounds
    `);
    const { members, projects, grants, open_rounds } = counts.rows[0];
    console.log(
      `\n  members: ${members}, projects: ${projects}, grants: ${grants}, open rounds: ${open_rounds}`,
    );
    console.log('\nReady.');
  }
} finally {
  await pool.end().catch(() => {});
}

process.exit(failed ? 1 : 0);
