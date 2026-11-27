import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard (#2724): a table that carries origin columns is only inserted into by the data layer,
 * which writes the origin from an `Origin`. A new insert elsewhere must either go through
 * those functions or be added here on purpose.
 */
const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const SCAN_ROOTS = ['packages', 'apps'];
const ALLOWED = new Set([
  // The data layer.
  'packages/core/src/coherence/server/mutations.ts',
  // Signal creation for AI clients (#2744): its own insert, with the origin from an `Origin`.
  'packages/core/src/coherence/server/signal-write-store.ts',
  'packages/core/src/space-quests/server/mutations.ts',
  // Test fixtures that seed rows with an explicit origin.
  'packages/core/src/features/__tests__/list-signals.db.integration.test.ts',
  'packages/core/src/features/__tests__/list-quests.db.integration.test.ts',
]);

const TYPESCRIPT_INSERT =
  /\.insert\(\s*(?:[\w$]+\.)?(?:coherences|spaceQuests|spaceQuestUpdates)\b/;
const RAW_SQL_INSERT =
  /insert\s+into\s+(?:public\.)?"?(?:coherences|space_quests|space_quest_updates)\b/i;

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

describe('origin insert guard', () => {
  it('lets only the data layer insert into tables with origin columns', () => {
    const offenders: string[] = [];
    for (const relative of sourceFiles()) {
      if (ALLOWED.has(relative)) continue;
      if (relative.endsWith('origin-insert-guard.test.ts')) continue;
      const text = readFileSync(path.join(REPO_ROOT, relative), 'utf8');
      if (TYPESCRIPT_INSERT.test(text) || RAW_SQL_INSERT.test(text)) {
        offenders.push(relative);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('still finds the data layer (the scan is not empty)', () => {
    const text = readFileSync(
      path.join(REPO_ROOT, 'packages/core/src/coherence/server/mutations.ts'),
      'utf8',
    );
    expect(TYPESCRIPT_INSERT.test(text)).toBe(true);
  });
});
