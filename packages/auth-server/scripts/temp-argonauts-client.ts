/**
 * TEMP (#2608, K60): local-only test client for the Argonauts app. NOT for the AS extraction.
 * Registers a hand-made public client row (PKCE S256, no secret) and plays the app's part of the
 * authorization-code flow in a browser, then calls v2 with the app's client key + the AS token.
 *
 *   npx tsx scripts/temp-argonauts-client.ts start
 *   (open the printed link, sign in, Allow; the browser lands on the app's callback URL: copy it
 *    even if the app has no such route yet, the code is in the address bar)
 *   npx tsx scripts/temp-argonauts-client.ts finish "<full address>"
 *
 * client_id = the app's #2515 registry slug (so the v2 client mapping holds). The client key is
 * read from ARGONAUTS_ENV_FILE (default ../../experiences/argonauts/.env.local) and never printed.
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';

const ISSUER = (process.env.AUTH_SERVER_ISSUER ?? '').replace(/\/$/, '');
const DB = process.env.BRANCH_DB_URL || process.env.DEFAULT_DB_URL;
const CLIENT_ID = process.env.TEMP_CLIENT_ID ?? 'test-app';
const REDIRECT = 'http://localhost:3001/auth/hypha/callback';
const RESOURCE = `${ISSUER}/api/v2`;
const STATE_FILE = join(tmpdir(), 'hypha-as-argonauts-temp.json');
const ENV_FILE =
  process.env.ARGONAUTS_ENV_FILE ??
  'C:/Users/rozag/projects/hypha/experiences/argonauts/.env.local';

if (!ISSUER || !DB) throw new Error('set AUTH_SERVER_ISSUER and DEFAULT_DB_URL');
const [cmd, arg] = process.argv.slice(2);

if (cmd === 'start') {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(8).toString('hex');
  const pool = new pg.Pool({ connectionString: DB, max: 1 });
  await pool.query('delete from as_oauth_client where "clientId" = $1', [CLIENT_ID]);
  await pool.query(
    `insert into as_oauth_client (id, "clientId", scopes, "redirectUris", "grantTypes", "responseTypes", "tokenEndpointAuthMethod", name, uri, "requirePKCE", "createdAt", "updatedAt")
     values ($1, $2, '["spaces:read","offline_access"]', $3, '["authorization_code","refresh_token"]', '["code"]', 'none', 'Argonauts (local test)', 'http://localhost:3001', true, now(), now())`,
    [`temp-${CLIENT_ID}`, CLIENT_ID, JSON.stringify([REDIRECT])],
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
  console.log(`Client "${CLIENT_ID}" registered. Open:\n\n${url}\n\nThen: finish "<address>"`);
} else if (cmd === 'finish') {
  if (!arg || !existsSync(STATE_FILE)) throw new Error('run start, then pass the address');
  const saved = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  const back = new URL(arg);
  if (back.searchParams.get('state') !== saved.state) throw new Error('state mismatch');
  const code = back.searchParams.get('code');
  if (!code) throw new Error('no code in that address');
  const res = await fetch(`${ISSUER}/api/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: saved.verifier,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT,
      resource: RESOURCE,
    }).toString(),
  });
  const tok = (await res.json()) as Record<string, string>;
  if (res.status !== 200) throw new Error(`token ${res.status} ${JSON.stringify(tok)}`);
  const c = JSON.parse(Buffer.from(tok.access_token!.split('.')[1]!, 'base64url').toString());
  console.log('claims:', { ...c, sub: '<hidden>' });
  const key = /^HYPHA_CLIENT_KEY=(.*)$/m.exec(readFileSync(ENV_FILE, 'utf8'))?.[1]?.trim();
  if (!key) throw new Error('no HYPHA_CLIENT_KEY in the env file');
  const slug = process.env.TEMP_SPACE_SLUG;
  const path = slug ? `/api/v2/spaces/${slug}/memberships/me` : '/api/v2/spaces?pageSize=1';
  const call = async (label: string, headers: Record<string, string>) => {
    const r = await fetch(`${ISSUER}${path}`, { headers });
    console.log(label, '->', r.status, (await r.text()).slice(0, 160));
  };
  await call('v2 key + AS token', { 'x-hypha-client-key': key, authorization: `Bearer ${tok.access_token}` });
  await call('v2 key + tampered token', { 'x-hypha-client-key': key, authorization: `Bearer ${tok.access_token!.slice(0, -40)}A${tok.access_token!.slice(-39)}` });
} else {
  console.log('usage: start | finish "<address>"');
}
