/**
 * Reports the configuration of the regen-sydney Vercel project: build settings,
 * domains, the git connection, and which environment variables are set.
 *
 * Variable names and targets are listed; values are never fetched.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const TEAM = 'team_YAelhta9tYGFYAu3jPN1TE5v';
const PROJECT = process.argv[2] ?? 'regen-sydney';

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

async function api(path) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message ?? `${response.status}`);
  return json;
}

const project = await api(`/v9/projects/${PROJECT}?teamId=${TEAM}`);

console.log(`${project.name}  (${project.id})`);
console.log(`  framework       ${project.framework ?? '—'}`);
console.log(`  root directory  ${project.rootDirectory ?? '(repo root)'}`);
console.log(`  node            ${project.nodeVersion ?? '—'}`);
console.log(`  build command   ${project.buildCommand ?? '(framework default)'}`);
console.log(`  install command ${project.installCommand ?? '(default)'}`);
if (project.link) {
  console.log(
    `  git             ${project.link.type}:${project.link.org}/${project.link.repo}` +
      `${project.link.productionBranch ? ` (production: ${project.link.productionBranch})` : ''}`,
  );
} else {
  console.log('  git             not connected');
}

const { domains } = await api(`/v9/projects/${PROJECT}/domains?teamId=${TEAM}`);
console.log(`\nDomains (${domains.length})`);
for (const domain of domains) {
  console.log(`  ${domain.name}${domain.verified ? '' : '  (unverified)'}`);
}

const { envs } = await api(`/v10/projects/${PROJECT}/env?teamId=${TEAM}`);
console.log(`\nEnvironment variables (${envs.length})`);
const width = Math.max(0, ...envs.map((e) => e.key.length));
for (const env of envs.sort((a, b) => a.key.localeCompare(b.key))) {
  const targets = Array.isArray(env.target) ? env.target.join(', ') : env.target;
  // `sensitive` values cannot be read back at all, by anyone — worth showing,
  // because it decides whether `vercel env pull` can retrieve them.
  const origin = env.type === 'sensitive' ? 'sensitive' : env.type;
  console.log(
    `  ${env.key.padEnd(width)}  ${origin.padEnd(9)}  ${targets}`,
  );
}

const { deployments } = await api(
  `/v6/deployments?projectId=${project.id}&teamId=${TEAM}&limit=3`,
);
console.log(`\nRecent deployments`);
for (const deployment of deployments) {
  const when = new Date(deployment.created).toISOString().slice(0, 16).replace('T', ' ');
  console.log(`  ${when}  ${deployment.state.padEnd(9)} ${deployment.target ?? 'preview'}  https://${deployment.url}`);
}
