import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The wallet provider's confirmation may be hidden in exactly one place,
 * `vote-signing.ts`, behind `UserExplicitConsent`. This grep-style test fails
 * if the option shows up anywhere else in the source. It cannot stop a
 * determined caller (a renamed option, a dynamic key, a config change); it
 * makes an accidental or "simplifying" bypass show up in review and CI.
 */
const REPO_ROOT = resolve(__dirname, '../../../../../../..');
const ROOTS = ['apps', 'packages'];
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  '.turbo',
  'coverage',
  'artifacts',
  'cache',
  'typechain-types',
]);
const ALLOWED = [
  [
    'packages',
    'core',
    'src',
    'governance',
    'client',
    'hooks',
    'vote-signing.ts',
  ].join('/'),
  // This file and the behaviour test mention the option by name.
  [
    'packages',
    'core',
    'src',
    'governance',
    'client',
    'hooks',
    '__tests__',
    'vote-signing.guard.test.ts',
  ].join('/'),
  [
    'packages',
    'core',
    'src',
    'governance',
    'client',
    'hooks',
    '__tests__',
    'vote-signing.test.ts',
  ].join('/'),
];
const OPTION = 'showWalletUIs';

const walk = (dir: string, out: string[]) => {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(full);
  }
};

describe('wallet confirmation bypass guard', () => {
  it('uses the modal-hiding option only inside vote-signing.ts', () => {
    const files: string[] = [];
    for (const root of ROOTS) walk(join(REPO_ROOT, root), files);
    expect(files.length).toBeGreaterThan(100);
    const offenders = files
      .map((f) => relative(REPO_ROOT, f).split(sep).join('/'))
      .filter((rel) => !ALLOWED.includes(rel))
      .filter((rel) =>
        readFileSync(join(REPO_ROOT, rel), 'utf8').includes(OPTION),
      );
    expect(offenders).toEqual([]);
  });
});
