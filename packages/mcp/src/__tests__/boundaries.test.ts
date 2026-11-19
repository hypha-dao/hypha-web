import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' ? [] : sources(path);
    }
    return name.endsWith('.ts') ? [path] : [];
  });
}

const files = sources(SRC);
const importsOf = (file: string) =>
  [
    ...readFileSync(file, 'utf8').matchAll(
      /^\s*(import|export)\s[^;]*?from\s+'([^']+)'/gm,
    ),
  ].map((m) => ({ statement: m[0], specifier: m[2]! }));

describe('the MCP package boundary', () => {
  it('finds its sources', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('never imports the database or the authorization-server package', () => {
    for (const file of files) {
      for (const { specifier } of importsOf(file)) {
        expect(specifier, file).not.toMatch(
          /storage-postgres|auth-server|better-auth|drizzle|\bpg\b/,
        );
      }
    }
  });

  it('takes core only as types: feature functions arrive injected (McpDeps)', () => {
    for (const file of files) {
      for (const { statement, specifier } of importsOf(file)) {
        if (specifier.startsWith('@hypha-platform/core')) {
          expect(statement, file).toMatch(/^\s*import\s+type\s/);
        }
      }
    }
  });

  it('keeps model-facing text in descriptions/: no tool text elsewhere', () => {
    for (const file of files.filter((f) => !f.includes('descriptions'))) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/description:\s*['"`]/);
    }
  });
});
