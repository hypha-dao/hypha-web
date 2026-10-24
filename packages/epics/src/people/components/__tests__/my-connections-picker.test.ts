import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../my-connections.tsx'),
  'utf8',
);

describe('group picker chips and radio', () => {
  it('keeps the search needle when a selected chip is removed', () => {
    expect(source).toContain('conversationsMatchingSearch(members, needle)');
    expect(source).toContain('onClick={() => toggleSelected(row)}');
    expect(source).not.toMatch(/toggleSelected\(row\);\s*setQuery\(/);
  });

  it('selects a member when the radio circle is tapped', () => {
    expect(source).toContain('onClick={(event) => {');
    expect(source).toContain('event.stopPropagation()');
    expect(source).toContain('onOpen(row)');
  });
});
