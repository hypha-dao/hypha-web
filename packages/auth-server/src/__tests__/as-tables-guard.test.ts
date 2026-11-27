import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard (#2756): the authorization server's tables (`as_*`) belong to this package. Application
 * code reads what it needs about a client or a grant from the verified access token (for example
 * `space_grants` and `client_name`), never from these tables, so the two services can be split
 * later. A reference anywhere else must be removed, or added here on purpose with a reason.
 */
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SCAN_ROOTS = ['packages', 'apps'];
const OWNER = 'packages/auth-server/';
const ALLOWED = new Set<string>([]);

// The table names the authorization server creates (better-auth model names, see `auth.ts`).
const AS_TABLE =
  /\bas_(?:user|session|account|verification|jwks|oauth_[a-z_]+)\b/;

/** Tracked source files only (fast, and ignores build output). */
function sourceFiles(): string[] {
  return execFileSync('git', ['ls-files', '--', ...SCAN_ROOTS], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\n')
    .filter(
      (file) =>
        /\.(ts|tsx|mts|mjs|js)$/.test(file) && !file.includes('/migrations/'),
    );
}

describe('authorization server tables guard', () => {
  it('keeps references to as_* tables inside the authorization server package', () => {
    const offenders: string[] = [];
    for (const relative of sourceFiles()) {
      if (relative.startsWith(OWNER) || ALLOWED.has(relative)) continue;
      const text = readFileSync(path.join(REPO_ROOT, relative), 'utf8');
      if (AS_TABLE.test(text)) offenders.push(relative);
    }
    expect(offenders).toEqual([]);
  });

  it('still recognises a table name (the scan is not empty)', () => {
    const text = readFileSync(
      path.join(REPO_ROOT, 'packages/auth-server/src/auth.ts'),
      'utf8',
    );
    expect(AS_TABLE.test(text)).toBe(true);
  });
});
