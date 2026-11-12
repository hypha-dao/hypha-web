/**
 * Manual walkthrough helper (#2608). Plays the AI host's part so a person can try the flow in a
 * real browser with real Privy login. Local only; it writes a plain test client into the database.
 *
 *   npx tsx scripts/dev-walkthrough.ts start      # registers a test client, prints the link to open
 *   (open the link, sign in, press Allow; the browser lands on an address that does not load)
 *   npx tsx scripts/dev-walkthrough.ts finish "<the full address from the browser bar>"
 *   npx tsx scripts/dev-walkthrough.ts refresh    # optional: trade the refresh token for a new pair
 *
 * Environment: the same variables as the app (BRANCH_DB_URL or DEFAULT_DB_URL, AUTH_SERVER_ISSUER).
 * A CIMD client cannot be used here: its document must live on a public https URL.
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';

const ISSUER = (process.env.AUTH_SERVER_ISSUER ?? '').replace(/\/$/, '');
const DB = process.env.BRANCH_DB_URL || process.env.DEFAULT_DB_URL;
const CLIENT_ID = 'walkthrough-client';
const REDIRECT = 'http://127.0.0.1:8976/callback';
const STATE_FILE = join(tmpdir(), 'hypha-as-walkthrough.json');
const RESOURCE = `${ISSUER}/api/auth/test`;

if (!ISSUER || !DB) {
  throw new Error(
    'set AUTH_SERVER_ISSUER and BRANCH_DB_URL (or DEFAULT_DB_URL), the same values as the app',
  );
}

type State = { verifier: string; state: string; refresh_token?: string };
const readState = (): State => {
  if (!existsSync(STATE_FILE)) throw new Error('run "start" first');
  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as State;
};

async function token(body: Record<string, string>) {
  const res = await fetch(`${ISSUER}/api/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, string>;
  if (res.status !== 200) {
    console.log(`Token request failed: ${res.status}`, json);
    process.exit(1);
  }
  return json;
}

function claims(jwt: string) {
  return JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString());
}

async function callProtected(accessToken: string) {
  const res = await fetch(RESOURCE, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  console.log(`Protected route ${RESOURCE} -> ${res.status}`);
  console.log(await res.text());
}

const [cmd, arg] = process.argv.slice(2);

if (cmd === 'start') {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(8).toString('hex');
  const pool = new pg.Pool({ connectionString: DB, max: 1 });
  await pool.query('delete from as_oauth_client where "clientId" = $1', [
    CLIENT_ID,
  ]);
  await pool.query(
    `insert into as_oauth_client (id, "clientId", scopes, "redirectUris", "grantTypes", "responseTypes", "tokenEndpointAuthMethod", name, uri, "requirePKCE", "createdAt", "updatedAt")
     values ('walkthrough1', $1, '["spaces:read","offline_access"]', $2, '["authorization_code","refresh_token"]', '["code"]', 'none', 'Walkthrough test app', 'http://127.0.0.1:8976', true, now(), now())`,
    [CLIENT_ID, JSON.stringify([REDIRECT])],
  );
  await pool.end();
  writeFileSync(STATE_FILE, JSON.stringify({ verifier, state }));
  const url = new URL(`${ISSUER}/api/auth/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    scope: 'spaces:read offline_access',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: RESOURCE,
  }).toString();
  console.log('Test client registered. Open this link in your browser:\n');
  console.log(url.toString());
  console.log(
    '\nAfter you press Allow the browser goes to http://127.0.0.1:8976/callback?... which shows an error page. That is expected.\nCopy the FULL address from the address bar and run:\n  npx tsx scripts/dev-walkthrough.ts finish "<address>"',
  );
} else if (cmd === 'finish') {
  if (!arg) throw new Error('pass the full address from the browser bar');
  const saved = readState();
  const back = new URL(arg);
  if (back.searchParams.get('state') !== saved.state) {
    throw new Error('state does not match: run "start" again');
  }
  if (back.searchParams.get('iss') !== ISSUER) {
    console.log('Warning: iss parameter is', back.searchParams.get('iss'));
  }
  const code = back.searchParams.get('code');
  if (!code) throw new Error('no code in that address');
  const tok = await token({
    grant_type: 'authorization_code',
    code,
    code_verifier: saved.verifier,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    resource: RESOURCE,
  });
  console.log('Access token claims:', claims(tok.access_token!));
  console.log(
    'Refresh token issued:',
    tok.refresh_token ? 'yes' : 'NO (unexpected)',
  );
  if (tok.refresh_token) {
    writeFileSync(
      STATE_FILE,
      JSON.stringify({ ...saved, refresh_token: tok.refresh_token }),
    );
  }
  await callProtected(tok.access_token!);
} else if (cmd === 'refresh') {
  const saved = readState();
  if (!saved.refresh_token) throw new Error('no refresh token: run "finish"');
  const tok = await token({
    grant_type: 'refresh_token',
    refresh_token: saved.refresh_token,
    client_id: CLIENT_ID,
    resource: RESOURCE,
  });
  writeFileSync(
    STATE_FILE,
    JSON.stringify({ ...saved, refresh_token: tok.refresh_token }),
  );
  console.log('Refreshed. New access token claims:', claims(tok.access_token!));
  await callProtected(tok.access_token!);
} else {
  console.log('usage: start | finish "<address>" | refresh');
}
