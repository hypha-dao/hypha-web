import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../my-connections.tsx'),
  'utf8',
);

describe('group picker chips and radio', () => {
  it('keeps the search needle when a selected chip is removed', () => {
    expect(source).toContain('membersForGroupPicker(titledMembers, picking)');
    expect(source).toContain('conversationsMatchingSearch');
    expect(source).toContain('picking || Boolean(query.trim())');
    expect(source).toContain('mergeDirectoryPeople');
    expect(source).toContain('onClick={() => toggleSelected(row)}');
    expect(source).not.toMatch(/toggleSelected\(row\);\s*setQuery\(/);
    expect(source).toMatch(/function exitPicking\(\) \{[\s\S]*setQuery\(''\)/);
  });

  it('resolves Matrix ids for every pick before createRoom', () => {
    expect(source).toContain('resolvedMatrixIdsForGroup');
    expect(source).toContain('disabled={!canStartGroup}');
    const resolveAt = source.indexOf(
      'const memberIds = resolvedMatrixIdsForGroup',
    );
    const createAt = source.indexOf('createRoom(title,');
    expect(resolveAt).toBeGreaterThan(-1);
    expect(createAt).toBeGreaterThan(resolveAt);
  });

  it('selects a member when the radio circle is tapped', () => {
    expect(source).toContain('onClick={(event) => {');
    expect(source).toContain('event.stopPropagation()');
    expect(source).toContain('onOpen(row)');
  });
});
