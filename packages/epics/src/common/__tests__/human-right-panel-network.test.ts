import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../human-right-panel.tsx'),
  'utf8',
);

describe('network room join guard', () => {
  it('only ensures the network room on /{lang}/network', () => {
    expect(source).toContain('isNetworkPath(pathname)');
    expect(source).toContain('ensureNetworkRoom');
    const ensureAt = source.indexOf('await ensureNetworkRoom()');
    expect(ensureAt).toBeGreaterThan(-1);
    const guardAt = source.lastIndexOf(
      'if (!isNetworkPath(pathname)) return;',
      ensureAt,
    );
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(ensureAt);
  });
});
