/**
 * Explains what the logged-in Vercel CLI account can actually reach.
 *
 * `vercel project ls` only shows the current scope, which makes an access
 * problem look like an empty account. This asks the API directly: who am I,
 * which teams am I in, what are their real team_ ids, and does the org this
 * repo is linked to appear among them.
 *
 * Reads the CLI's own token. Prints no credentials.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const authPaths = [
  join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json'),
  join(homedir(), '.local/share/com.vercel.cli/auth.json'),
  join(homedir(), '.config/com.vercel.cli/auth.json'),
];

let token;
for (const path of authPaths) {
  try {
    token = JSON.parse(readFileSync(path, 'utf8')).token;
    if (token) break;
  } catch {
    // try the next location
  }
}

if (!token) {
  console.error('No Vercel CLI token found — run `vercel login`.');
  process.exit(1);
}

async function api(path) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message ?? `${response.status} on ${path}`);
  }
  return json;
}

const user = await api('/v2/user');
console.log(`Signed in as ${user.user.username} <${user.user.email}>`);
console.log(`  personal account id  ${user.user.id}\n`);

const { teams } = await api('/v2/teams');
console.log(`Teams (${teams.length})`);
for (const team of teams) {
  console.log(`  ${team.name}`);
  console.log(`    slug ${team.slug}`);
  console.log(`    id   ${team.id}`);
  try {
    const { projects } = await api(`/v9/projects?teamId=${team.id}&limit=100`);
    console.log(`    projects (${projects.length})${projects.length ? ':' : ''}`);
    for (const project of projects) {
      console.log(`      ${project.name}  (${project.id})`);
    }
  } catch (error) {
    console.log(`    projects: could not read — ${error.message}`);
  }
}

try {
  const { projects } = await api('/v9/projects?limit=100');
  console.log(`\nPersonal-scope projects (${projects.length})`);
  for (const project of projects) {
    console.log(`  ${project.name}  (${project.id})`);
  }
} catch (error) {
  console.log(`\nPersonal-scope projects: ${error.message}`);
}

// What this repo is pinned to, and whether the account above can see it.
try {
  const linked = JSON.parse(
    readFileSync(new URL('../../../.vercel/project.json', import.meta.url), 'utf8'),
  );
  console.log(`\nThis repo is linked to`);
  console.log(`  project ${linked.projectName} (${linked.projectId})`);
  console.log(`  org     ${linked.orgId}`);

  const visible = teams.some((team) => team.id === linked.orgId);
  console.log(`  in a team you belong to: ${visible ? 'yes' : 'NO'}`);

  if (!visible) {
    try {
      await api(`/v9/projects/${linked.projectId}?teamId=${linked.orgId}`);
      console.log('  …but the project reads fine, so access is there after all');
    } catch (error) {
      console.log(`  reading it directly also fails: ${error.message}`);
    }
  }
} catch {
  console.log('\nNo .vercel/project.json at the repo root.');
}
