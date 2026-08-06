/**
 * The campaign must never open a connection to the Hypha platform database.
 *
 * Everything else in this app is arranged so that cannot happen — no Hypha
 * package is imported, no Hypha variable is read — but the one remaining way
 * to get it wrong is human: pasting Hypha's connection string into
 * CAMPAIGN_DB_URL while setting up a deploy. These tests cover that case,
 * because it is the only one the code itself can still catch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const HYPHA_URL =
  'postgres://hypha:secret@ep-hypha.neon.tech/hypha?sslmode=require';
const CAMPAIGN_URL =
  'postgres://campaign:secret@ep-campaign.neon.tech/campaign?sslmode=require';

const TOUCHED = [
  'CAMPAIGN_DB_URL',
  'DEFAULT_DB_URL',
  'BRANCH_DB_URL',
  'DEFAULT_DB_AUTHENTICATED_URL',
  'DEFAULT_DB_ANONYMOUS_URL',
];

/**
 * Each case needs the module evaluated afresh, since the URL is read on
 * import, and the environment cleared, so a variable set by an earlier case
 * cannot be the one that trips the guard.
 */
async function loadDbModule(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const key of TOUCHED) delete process.env[key];
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) process.env[key] = value;
  }
  return import('../index');
}

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(TOUCHED.map((key) => [key, process.env[key]]));
  for (const key of TOUCHED) delete process.env[key];
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
});

describe('campaign database connection', () => {
  it('refuses a URL that matches Hypha DEFAULT_DB_URL', async () => {
    const { getDb } = await loadDbModule({
      CAMPAIGN_DB_URL: HYPHA_URL,
      DEFAULT_DB_URL: HYPHA_URL,
    });

    expect(() => getDb()).toThrowError(/same database as DEFAULT_DB_URL/);
  });

  it('refuses a URL that matches Hypha BRANCH_DB_URL', async () => {
    const { getDb } = await loadDbModule({
      CAMPAIGN_DB_URL: HYPHA_URL,
      BRANCH_DB_URL: HYPHA_URL,
    });

    expect(() => getDb()).toThrowError(/same database as BRANCH_DB_URL/);
  });

  it('refuses a URL matching either of the Neon RLS connection strings', async () => {
    const authenticated = await loadDbModule({
      CAMPAIGN_DB_URL: HYPHA_URL,
      DEFAULT_DB_AUTHENTICATED_URL: HYPHA_URL,
    });
    expect(() => authenticated.getDb()).toThrowError(
      /same database as DEFAULT_DB_AUTHENTICATED_URL/,
    );

    const anonymous = await loadDbModule({
      CAMPAIGN_DB_URL: HYPHA_URL,
      DEFAULT_DB_ANONYMOUS_URL: HYPHA_URL,
    });
    expect(() => anonymous.getDb()).toThrowError(
      /same database as DEFAULT_DB_ANONYMOUS_URL/,
    );
  });

  it('does not fall back to a Hypha variable when its own is unset', async () => {
    const { getDb, isDatabaseConfigured } = await loadDbModule({
      CAMPAIGN_DB_URL: undefined,
      DEFAULT_DB_URL: HYPHA_URL,
      BRANCH_DB_URL: HYPHA_URL,
    });

    expect(isDatabaseConfigured()).toBe(false);
    // Loudly unconfigured, rather than quietly connected to the wrong database.
    expect(() => getDb()).toThrowError(/CAMPAIGN_DB_URL is not set/);
  });

  it('accepts its own database even while Hypha variables are present', async () => {
    const { isDatabaseConfigured } = await loadDbModule({
      CAMPAIGN_DB_URL: CAMPAIGN_URL,
      DEFAULT_DB_URL: HYPHA_URL,
    });

    expect(isDatabaseConfigured()).toBe(true);
  });
});
