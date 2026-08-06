/**
 * Shared Vercel API access for the scripts in this directory.
 *
 * The token is the one `vercel login` already wrote, so nothing here asks for
 * a credential of its own.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const TEAM = 'team_YAelhta9tYGFYAu3jPN1TE5v';
export const PROJECT = 'regen-sydney';
export const PRODUCTION_URL = 'https://regen-sydney.vercel.app';

function readToken() {
  for (const path of [
    join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json'),
    join(homedir(), '.local/share/com.vercel.cli/auth.json'),
  ]) {
    try {
      const { token } = JSON.parse(readFileSync(path, 'utf8'));
      if (token) return token;
    } catch {
      // try the next location
    }
  }
  console.error('No Vercel CLI token — run `vercel login`.');
  process.exit(1);
}

const token = readToken();

export async function vercel(path, init = {}) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message ?? `${response.status} on ${path}`);
  }
  return json;
}

/**
 * Replaces a variable outright rather than editing in place, because an entry
 * may already exist against a different set of targets than the one wanted.
 */
export async function setEnv(key, value, targets, { encrypted = false } = {}) {
  const { envs } = await vercel(`/v10/projects/${PROJECT}/env?teamId=${TEAM}`);
  for (const entry of envs.filter((e) => e.key === key)) {
    await vercel(`/v9/projects/${PROJECT}/env/${entry.id}?teamId=${TEAM}`, {
      method: 'DELETE',
    });
  }
  await vercel(`/v10/projects/${PROJECT}/env?teamId=${TEAM}`, {
    method: 'POST',
    body: JSON.stringify({
      key,
      value,
      type: encrypted ? 'encrypted' : 'plain',
      target: targets,
    }),
  });
}

/**
 * The hostname Vercel keeps pointed at the newest preview of a branch. Unlike
 * a deployment URL it survives the next push, which is what a webhook endpoint
 * and an OAuth redirect both need.
 */
export function branchAlias(branch) {
  const slug = branch.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  return `https://${PROJECT}-git-${slug}-hypha-dao.vercel.app`;
}

/** Reads one value out of a local dotenv file without pulling in a parser. */
export function fromEnvFile(contents, name) {
  return (
    new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`, 'm')
      .exec(contents)?.[1]
      ?.trim()
      .replace(/^["']|["']$/g, '') || ''
  );
}
