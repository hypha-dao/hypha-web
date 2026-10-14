/**
 * The campaign must never open a connection to the Hypha platform database.
 *
 * Everything else in this app is arranged so that cannot happen — no Hypha
 * package is imported, no Hypha variable is read — but the one remaining way
 * to get it wrong is human: pasting Hypha's connection string into one of the
 * campaign's own variables while setting up a deploy. These tests cover that
 * case, because it is the only one the code itself can still catch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const HYPHA_URL =
  'postgres://hypha:secret@ep-hypha.neon.tech/hypha?sslmode=require';
const CAMPAIGN_URL =
  'postgres://campaign:secret@ep-campaign.neon.tech/campaign?sslmode=require';

const TOUCHED = [
  'CAMPAIGN_DB_URL',
  'CAMPAIGN_DB_DATABASE_URL',
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

    expect(() => getDb()).toThrowError(/same as DEFAULT_DB_URL/);
  });

  it('refuses a URL that matches Hypha BRANCH_DB_URL', async () => {
    const { getDb } = await loadDbModule({
      CAMPAIGN_DB_URL: HYPHA_URL,
      BRANCH_DB_URL: HYPHA_URL,
    });

    expect(() => getDb()).toThrowError(/same as BRANCH_DB_URL/);
  });

  it('refuses a URL matching either of the Neon RLS connection strings', async () => {
    const authenticated = await loadDbModule({
      CAMPAIGN_DB_URL: HYPHA_URL,
      DEFAULT_DB_AUTHENTICATED_URL: HYPHA_URL,
    });
    expect(() => authenticated.getDb()).toThrowError(
      /same as DEFAULT_DB_AUTHENTICATED_URL/,
    );

    const anonymous = await loadDbModule({
      CAMPAIGN_DB_URL: HYPHA_URL,
      DEFAULT_DB_ANONYMOUS_URL: HYPHA_URL,
    });
    expect(() => anonymous.getDb()).toThrowError(
      /same as DEFAULT_DB_ANONYMOUS_URL/,
    );
  });

  it('does not fall back to a Hypha variable when its own is unset', async () => {
    const { getDb, isDatabaseConfigured } = await loadDbModule({
      CAMPAIGN_DB_URL: undefined,
      CAMPAIGN_DB_DATABASE_URL: undefined,
      DEFAULT_DB_URL: HYPHA_URL,
      BRANCH_DB_URL: HYPHA_URL,
    });

    expect(isDatabaseConfigured()).toBe(false);
    // Loudly unconfigured, rather than quietly connected to the wrong database.
    expect(() => getDb()).toThrowError(/Neither CAMPAIGN_DB_URL nor/);
  });

  it('accepts its own database even while Hypha variables are present', async () => {
    const { isDatabaseConfigured } = await loadDbModule({
      CAMPAIGN_DB_URL: CAMPAIGN_URL,
      DEFAULT_DB_URL: HYPHA_URL,
    });

    expect(isDatabaseConfigured()).toBe(true);
  });

  /**
   * The Neon integration publishes CAMPAIGN_DB_DATABASE_URL on the Vercel
   * project, and its value is marked sensitive, so it cannot be read back and
   * copied into CAMPAIGN_DB_URL. Deploys therefore rely on this second name.
   */
  it('reads the name the Neon integration publishes', async () => {
    const { isDatabaseConfigured } = await loadDbModule({
      CAMPAIGN_DB_DATABASE_URL: CAMPAIGN_URL,
      DEFAULT_DB_URL: HYPHA_URL,
    });

    expect(isDatabaseConfigured()).toBe(true);
  });

  it('prefers CAMPAIGN_DB_URL when both names are set', async () => {
    const { getDb } = await loadDbModule({
      CAMPAIGN_DB_URL: HYPHA_URL,
      CAMPAIGN_DB_DATABASE_URL: CAMPAIGN_URL,
      DEFAULT_DB_URL: HYPHA_URL,
    });

    // Proves which of the two was chosen: only the explicit one matches Hypha.
    expect(() => getDb()).toThrowError(/same as DEFAULT_DB_URL/);
  });

  it('refuses the integration name too, if it somehow matches Hypha', async () => {
    const { getDb } = await loadDbModule({
      CAMPAIGN_DB_DATABASE_URL: HYPHA_URL,
      DEFAULT_DB_URL: HYPHA_URL,
    });

    expect(() => getDb()).toThrowError(/same as DEFAULT_DB_URL/);
  });
});
