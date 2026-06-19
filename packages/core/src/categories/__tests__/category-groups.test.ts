import { describe, expect, it } from 'vitest';
import {
  CATEGORY_GROUPS,
  collapseCategoriesToGroups,
  expandCategoryGroups,
  extractUniqueCategoryGroups,
  mergeCategoryGroupsWithExisting,
  parseCategoryGroupFilterParam,
  spaceMatchesCategoryGroups,
} from '../groups';
import { CATEGORIES } from '../types';

describe('category groups', () => {
  it('maps every active category to exactly one group', () => {
    const activeCategories = CATEGORIES.filter(
      (category) => category !== 'art' && category !== 'events',
    );
    const grouped = new Set(
      CATEGORY_GROUPS.flatMap((group) => group.categories),
    );

    expect(grouped.size).toBe(activeCategories.length);
    for (const category of activeCategories) {
      expect(grouped.has(category)).toBe(true);
    }
  });

  it('expands and collapses groups consistently', () => {
    const expanded = expandCategoryGroups([
      'environment',
      'energy',
      'technology',
    ]);
    expect(expanded).toEqual(
      expect.arrayContaining(['ocean', 'energy', 'tech']),
    );
    expect(collapseCategoriesToGroups(expanded)).toEqual([
      'environment',
      'energy',
      'technology',
    ]);
  });

  it('matches spaces by grouped categories', () => {
    expect(
      spaceMatchesCategoryGroups(['ocean', 'governance'], ['environment']),
    ).toBe(true);
    expect(spaceMatchesCategoryGroups(['governance'], ['environment'])).toBe(
      false,
    );
  });

  it('parses legacy category params into groups', () => {
    expect(parseCategoryGroupFilterParam('ocean,governance')).toEqual([
      'environment',
      'governance',
    ]);
    expect(parseCategoryGroupFilterParam('energy')).toEqual(['energy']);
  });

  it('preserves existing granular tags when re-saving grouped selections', () => {
    expect(mergeCategoryGroupsWithExisting(['environment'], ['ocean'])).toEqual(
      ['ocean'],
    );
    expect(
      mergeCategoryGroupsWithExisting(['environment', 'technology'], ['ocean']),
    ).toEqual(['ocean', 'innovation']);
    expect(mergeCategoryGroupsWithExisting(['food'], [])).toEqual(['food']);
  });

  it('extracts unique groups present in spaces', () => {
    expect(
      extractUniqueCategoryGroups([
        { categories: ['ocean'] },
        { categories: ['tech', 'governance'] },
      ]),
    ).toEqual(['environment', 'governance', 'technology']);
  });
});
