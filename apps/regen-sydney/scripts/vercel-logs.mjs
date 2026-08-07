/**
 * Prints the build log of a Vercel deployment.
 *
 *   node scripts/vercel-logs.mjs                    # latest deployment
 *   node scripts/vercel-logs.mjs <deployment-url>
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const TEAM = 'team_YAelhta9tYGFYAu3jPN1TE5v';
const PROJECT = 'prj_VDfqcWlLDmezeTIXTBFJOkHrhxEe';

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

async function api(path) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message ?? `${response.status}`);
  return json;
}

let id = process.argv[2];
if (id?.startsWith('https://')) id = id.replace('https://', '');

if (!id) {
  const { deployments } = await api(
    `/v6/deployments?projectId=${PROJECT}&teamId=${TEAM}&limit=1`,
  );
  if (!deployments.length) {
    console.log('No deployments yet.');
    process.exit(0);
  }
  id = deployments[0].uid;
  console.log(`Latest: https://${deployments[0].url}  (${deployments[0].state})\n`);
} else {
  const found = await api(`/v13/deployments/${id}?teamId=${TEAM}`);
  id = found.id;
}

const events = await api(`/v3/deployments/${id}/events?teamId=${TEAM}&builds=1&limit=1000`);
const list = Array.isArray(events) ? events : (events.events ?? []);

for (const event of list) {
  const text = event.text ?? event.payload?.text ?? '';
  if (!text.trim()) continue;
  console.log(text.replace(/\n$/, ''));
}
