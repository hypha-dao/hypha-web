import 'server-only';

import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { WebSocket } from 'ws';

import { schema } from './schema';

/**
 * The campaign's connection to the campaign's own database.
 *
 * Two names are accepted, in this order:
 *
 *   CAMPAIGN_DB_URL           set by hand — local development, or a database
 *                             provisioned outside Vercel
 *   CAMPAIGN_DB_DATABASE_URL  published by the Neon integration on the
 *                             regen-sydney Vercel project, which was given
 *                             `CAMPAIGN_DB` as its variable prefix
 *
 * Both begin `CAMPAIGN_DB`, and neither is a name the Hypha platform sets. The
 * property that matters is unchanged: no variable Hypha uses is read here, so
 * there is no environment in which a missing value quietly falls back to the
 * platform's connection string. A misconfigured deploy fails loudly instead.
 *
 * The integration's value is Neon's *pooled* endpoint, which is the right one
 * for serverless functions. Migrations prefer the unpooled companion — see
 * drizzle.config.ts.
 */
const connectionString =
  process.env.CAMPAIGN_DB_URL || process.env.CAMPAIGN_DB_DATABASE_URL || '';

/**
 * Hypha's connection string variables, read only so that one pasted into the
 * campaign's own variable by mistake can be recognised and refused.
 */
const HYPHA_DB_VARS = [
  'DEFAULT_DB_URL',
  'BRANCH_DB_URL',
  'DEFAULT_DB_AUTHENTICATED_URL',
  'DEFAULT_DB_ANONYMOUS_URL',
] as const;

export function isDatabaseConfigured(): boolean {
  return Boolean(connectionString);
}

/**
 * Pointing the campaign at Hypha's database would defeat every other
 * precaution here, and it is an easy mistake to make while wiring up a deploy.
 * Refusing to build the client is the only useful response: by the time a
 * query is in flight it is too late to be careful.
 */
function assertNotHyphaDatabase(candidate: string): void {
  for (const name of HYPHA_DB_VARS) {
    if (process.env[name] && process.env[name] === candidate) {
      throw new Error(
        `The campaign database is the same as ${name}. The campaign must own ` +
          `its data — point it at a separate Neon project. See ` +
          `apps/regen-sydney/README.md.`,
      );
    }
  }
}

function create() {
  if (!connectionString) {
    throw new Error(
      'Neither CAMPAIGN_DB_URL nor CAMPAIGN_DB_DATABASE_URL is set. The ' +
        'campaign keeps its data in its own database, separate from the Hypha ' +
        'platform — see apps/regen-sydney/README.md for provisioning one.',
    );
  }
  assertNotHyphaDatabase(connectionString);

  if (connectionString.includes('localhost')) {
    neonConfig.wsProxy = (host) => `${host}:5433/v1`;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineTLS = false;
    neonConfig.pipelineConnect = false;
  } else {
    neonConfig.webSocketConstructor = WebSocket;
    neonConfig.poolQueryViaFetch = true;
  }

  return drizzle(new Pool({ connectionString }), { schema });
}

export type CampaignDb = ReturnType<typeof create>;

let cached: CampaignDb | null = null;

/**
 * Built on first use rather than on import, so that `next build` — which loads
 * every route module while collecting page data — does not require a database
 * to be reachable. Only an actual query does.
 */
export function getDb(): CampaignDb {
  cached ??= create();
  return cached;
}

/**
 * A thin stand-in for the client so call sites can read `db.query…` directly
 * while construction stays lazy.
 */
export const db: CampaignDb = new Proxy({} as CampaignDb, {
  get(_target, property) {
    const client = getDb() as unknown as Record<string | symbol, unknown>;
    const value = client[property];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export * from './schema';
