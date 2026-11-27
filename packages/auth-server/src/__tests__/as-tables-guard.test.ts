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

const MIGRATIONS = 'packages/storage-postgres/migrations';

/**
 * The authorization server's tables, read from the migrations that create them, so a new `as_*`
 * table is guarded without editing this test.
 */
function authServerTables(): string[] {
  const names = new Set<string>();
  const files = execFileSync('git', ['ls-files', '--', MIGRATIONS], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((file) => file.endsWith('.sql'));
  const create =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?(as_[a-z0-9_]+)"?/gi;
  for (const file of files) {
    const sql = readFileSync(path.join(REPO_ROOT, file), 'utf8');
    for (const match of sql.matchAll(create)) {
      names.add(match[1]!.toLowerCase());
    }
  }
  return [...names].sort();
}

const TABLES = authServerTables();
// Case-insensitive, as SQL names are: `FROM AS_USER` is the same table.
const AS_TABLE = new RegExp(`\\b(?:${TABLES.join('|')})\\b`, 'i');

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

  it('knows the authorization server tables from the migrations', () => {
    for (const table of [
      'as_oauth_client',
      'as_jwks',
      'as_registration_slot',
      'as_identity',
      'as_client_grant',
    ]) {
      expect(TABLES).toContain(table);
    }
    // A Matrix application-service token is not one of them.
    expect(AS_TABLE.test('as_token')).toBe(false);
    expect(AS_TABLE.test('select * from AS_USER')).toBe(true);
  });

  it('still recognises a table name (the scan is not empty)', () => {
    const text = readFileSync(
      path.join(REPO_ROOT, 'packages/auth-server/src/auth.ts'),
      'utf8',
    );
    expect(AS_TABLE.test(text)).toBe(true);
  });
});
