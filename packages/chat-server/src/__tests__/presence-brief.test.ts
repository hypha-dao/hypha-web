import { describe, expect, it } from 'vitest';
import {
  formatEcosystemLines,
  formatSignedInMemberLine,
} from '../presence-brief-format';

describe('formatSignedInMemberLine', () => {
  it('names the member and how they show up, without asking who they are', () => {
    const line = formatSignedInMemberLine({
      name: 'Ada',
      surname: 'Lovelace',
      primaryOrientation: 'builder',
      description: 'I keep the greenhouse books.',
    });
    expect(line).toContain('Signed-in member: Ada Lovelace.');
    expect(line).toContain('They show up as a builder.');
    expect(line).toContain('In their own words: I keep the greenhouse books.');
    expect(line).toContain('Do not ask their name');
  });

  it('keeps investor as investor', () => {
    const line = formatSignedInMemberLine({
      name: 'Noor',
      primaryOrientation: 'investor',
    });
    expect(line).toContain('an investor');
    expect(line).toContain('find one project to resource');
    expect(line).not.toContain('funder');
  });
});

describe('formatEcosystemLines', () => {
  it('places the space among its root, parent, and nested spaces', () => {
    const lines = formatEcosystemLines({
      spaceSlug: 'grove',
      rootSpaceSlug: 'hypha',
      spaces: [
        { id: 1, slug: 'hypha', title: 'Hypha', parent_id: null },
        { id: 2, slug: 'food', title: 'Food', parent_id: 1 },
        { id: 3, slug: 'grove', title: 'Grove', parent_id: 2 },
        { id: 4, slug: 'north-tunnel', title: 'North tunnel', parent_id: 3 },
        { id: 5, slug: 'market', title: 'Market', parent_id: 1 },
      ],
    });
    expect(lines).toContain('Root: Hypha.');
    expect(lines).toContain('Parent: Food.');
    expect(lines).toContain('Nested here: North tunnel.');
    expect(lines).toContain('Also in this organisation: Market.');
    expect(lines).toContain('Do not invent a space');
  });

  it('says when the space stands alone', () => {
    const lines = formatEcosystemLines({
      spaceSlug: 'grove',
      rootSpaceSlug: 'grove',
      spaces: [{ id: 3, slug: 'grove', title: 'Grove', parent_id: null }],
    });
    expect(lines).toContain('stands alone');
    expect(lines).not.toContain('Root:');
  });
});
