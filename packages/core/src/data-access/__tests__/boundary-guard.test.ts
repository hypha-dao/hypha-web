import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DB_IMPORTERS } from './db-importers.ratchet';

/**
 * Guards of the data-access boundary (#2745).
 *
 * (a) Features and the access layer never hold a database handle: they import no value from the
 *     storage package, no `DbConfig`, no `getDb`, and no data module under a `server/` folder
 *     (only `data-access`). Type-only imports are fine. The few `server/` modules listed below
 *     read the chain, not the database.
 * (b) Ratchet: the files that import the `db` value may only become fewer.
 */
const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const CORE_SRC = 'packages/core/src';

/** `server/` modules that read the chain, not the database. */
const CHAIN_READ_MODULES = new Set([
  'packages/core/src/common/server/web3-rpc/client',
  'packages/core/src/space/server/is-on-chain-member-or-delegate',
  'packages/core/src/coherence/server/web3/get-member-voting-power',
]);

function listFiles(roots: string[]): string[] {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '--', ...roots],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
    .split('\n')
    .map((file) => file.trim())
    .filter((file) => /\.(ts|tsx|mts|mjs|js)$/.test(file));
}

const isTestFile = (file: string) =>
  file.includes('/__tests__/') || /\.(test|spec)\.[a-z]+$/.test(file);

/** `valueNames`: the named imports that bring in a value (not `type X`). */
type ImportStatement = {
  from: string;
  typeOnly: boolean;
  valueNames: string[];
};

/** Static imports of a file, with whether each brings in a value or only types. */
function importsOf(text: string): ImportStatement[] {
  const out: ImportStatement[] = [];
  const pattern =
    /import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;
  for (const match of text.matchAll(pattern)) {
    if (match[4]) {
      out.push({ from: match[4], typeOnly: false, valueNames: [] });
      continue;
    }
    const clause = match[2] ?? '';
    const typeOnlyStatement = Boolean(match[1]);
    const valueNames: string[] = [];
    const braces = clause.match(/\{([\s\S]*)\}/);
    if (braces && !typeOnlyStatement) {
      for (const raw of braces[1]!.split(',')) {
        const name = raw.trim();
        if (!name || name.startsWith('type ')) continue;
        valueNames.push(name.split(/\s+as\s+/)[0]!.trim());
      }
    }
    const outside = clause
      .replace(/\{[\s\S]*\}/, '')
      .replace(/,/g, '')
      .trim();
    out.push({
      from: match[3]!,
      typeOnly:
        typeOnlyStatement || (outside === '' && valueNames.length === 0),
      valueNames,
    });
  }
  return out;
}

/** Code without comments, so a word in a doc comment does not count. */
function codeOf(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

/** A relative import resolved to a repo path without extension; other specifiers as they are. */
function resolveSpecifier(file: string, specifier: string): string {
  if (!specifier.startsWith('.')) return specifier;
  return path.posix
    .join(path.posix.dirname(file), specifier)
    .replace(/\/index$/, '');
}

function boundaryOffences(file: string, text: string): string[] {
  const offences: string[] = [];
  for (const statement of importsOf(text)) {
    if (statement.typeOnly) continue;
    const target = resolveSpecifier(file, statement.from);
    if (target === '@hypha-platform/storage-postgres') {
      offences.push(`value import from ${statement.from}`);
    }
    if (target === `${CORE_SRC}/server`) {
      offences.push(`value import from the core server barrel`);
    }
    if (
      target.startsWith(`${CORE_SRC}/`) &&
      /(^|\/)server(\/|$)/.test(target.slice(CORE_SRC.length + 1)) &&
      !CHAIN_READ_MODULES.has(target)
    ) {
      offences.push(`value import from the data module ${statement.from}`);
    }
  }
  const code = codeOf(text);
  if (/\bDbConfig\b/.test(code)) offences.push('mentions DbConfig');
  if (/\bgetDb\b/.test(code)) offences.push('mentions getDb');
  if (/\bdb\b/.test(code)) offences.push('declares or uses `db`');
  return offences;
}

describe('data-access boundary guard', () => {
  const scoped = listFiles([
    `${CORE_SRC}/features`,
    `${CORE_SRC}/access`,
  ]).filter((file) => !isTestFile(file));

  it('features and the access layer reach the database only through data-access', () => {
    const offenders: string[] = [];
    for (const file of scoped) {
      const text = readFileSync(path.join(REPO_ROOT, file), 'utf8');
      for (const offence of boundaryOffences(file, text)) {
        offenders.push(`${file}: ${offence}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('scans the feature and access files (the scan is not empty)', () => {
    expect(scoped).toContain(`${CORE_SRC}/features/list-spaces/index.ts`);
    expect(scoped).toContain(`${CORE_SRC}/access/policy.ts`);
  });

  it('catches each kind of offence', () => {
    const file = `${CORE_SRC}/features/example/index.ts`;
    const offences = (text: string) => boundaryOffences(file, text);
    expect(
      offences(`import { db } from '@hypha-platform/storage-postgres';`),
    ).not.toEqual([]);
    expect(
      offences(`import { findSpaceById } from '../../space/server/queries';`),
    ).not.toEqual([]);
    expect(offences(`import { listSpaces } from '../../server';`)).not.toEqual(
      [],
    );
    expect(
      offences(`export function f(input: X, { db }: Y) { return db; }`),
    ).not.toEqual([]);
    expect(offences(`const config: DbConfig = x;`)).not.toEqual([]);
    expect(
      offences(
        `import type { SignalRow } from '../../coherence/server/list-signals-queries';`,
      ),
    ).toEqual([]);
    expect(
      offences(
        `import {\n  type SignalRow,\n  type SignalFilter,\n} from '../../coherence/server/list-signals-queries';`,
      ),
    ).toEqual([]);
    expect(
      offences(`import { findSpaceById } from '../../data-access/spaces';`),
    ).toEqual([]);
    expect(offences(`// the db is reached through data-access`)).toEqual([]);
  });
});

describe('db import ratchet', () => {
  function currentImporters(): string[] {
    return listFiles(['packages', 'apps'])
      .filter((file) => !isTestFile(file))
      .filter((file) => !file.startsWith(`${CORE_SRC}/data-access/`))
      .filter((file) => {
        const text = readFileSync(path.join(REPO_ROOT, file), 'utf8');
        return importsOf(text).some(
          (statement) =>
            statement.from === '@hypha-platform/storage-postgres' &&
            statement.valueNames.includes('db'),
        );
      })
      .sort();
  }

  it('no new file imports the db value; a file that stopped must leave the list', () => {
    const current = currentImporters();
    const listed = new Set(DB_IMPORTERS);
    const added = current.filter((file) => !listed.has(file));
    const gone = [...listed].filter((file) => !current.includes(file));
    expect(
      { added, gone },
      'Reach the database through connectionFor (core data-access) instead of importing `db`; ' +
        'remove files that no longer import it from db-importers.ratchet.ts.',
    ).toEqual({ added: [], gone: [] });
  });

  it('the MCP wiring and the consent page import no db', () => {
    expect(DB_IMPORTERS).not.toContain('apps/web/src/lib/mcp/wiring.ts');
    expect(DB_IMPORTERS).not.toContain(
      'apps/web/src/app/(auth)/auth/consent/own-spaces.ts',
    );
  });
});
