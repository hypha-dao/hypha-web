import { categories as categoryOptions } from './constants';
import { CATEGORIES, type Category } from './types';

export const CATEGORY_GROUP_IDS = [
  'arts_culture',
  'environment',
  'energy',
  'places',
  'food',
  'health',
  'education',
  'governance',
  'economy',
  'technology',
] as const;

export type CategoryGroupId = (typeof CATEGORY_GROUP_IDS)[number];

export type CategoryGroup = {
  id: CategoryGroupId;
  label: string;
  categories: readonly Category[];
};

export const CATEGORY_GROUPS = [
  {
    id: 'arts_culture',
    label: 'Arts & Culture',
    categories: ['arts', 'culture', 'media', 'gaming', 'sport', 'tourism'],
  },
  {
    id: 'environment',
    label: 'Environment',
    categories: ['biodiversity', 'bioregions', 'land', 'ocean', 'water'],
  },
  {
    id: 'energy',
    label: 'Energy',
    categories: ['energy'],
  },
  {
    id: 'places',
    label: 'Places & Housing',
    categories: ['cities', 'villages', 'housing'],
  },
  {
    id: 'food',
    label: 'Food & Agriculture',
    categories: ['food'],
  },
  {
    id: 'health',
    label: 'Health & Wellbeing',
    categories: ['health', 'wellbeing', 'emergency'],
  },
  {
    id: 'education',
    label: 'Education & Knowledge',
    categories: ['education', 'knowledge'],
  },
  {
    id: 'governance',
    label: 'Governance & Finance',
    categories: ['governance', 'finance', 'networks'],
  },
  {
    id: 'economy',
    label: 'Economy & Trade',
    categories: ['distribution', 'goods', 'services'],
  },
  {
    id: 'technology',
    label: 'Innovation & Tech',
    categories: ['innovation', 'tech', 'mobility'],
  },
] as const satisfies readonly CategoryGroup[];

const categoryToGroup = new Map<Category, CategoryGroupId>(
  CATEGORY_GROUPS.flatMap((group) =>
    group.categories.map((category) => [category, group.id]),
  ),
);

export const categoryGroupOptions = CATEGORY_GROUPS.map((group) => ({
  value: group.id,
  label: group.label,
}));

export function isCategoryGroupId(value: string): value is CategoryGroupId {
  return (CATEGORY_GROUP_IDS as readonly string[]).includes(value);
}

export function getCategoryGroup(id: CategoryGroupId): CategoryGroup {
  const group = CATEGORY_GROUPS.find((entry) => entry.id === id);
  if (!group) {
    throw new Error(`Unknown category group: ${id}`);
  }
  return group;
}

export function getCategoryGroupLabel(id: CategoryGroupId): string {
  return getCategoryGroup(id).label;
}

export function findCategoryGroupForCategory(
  category: Category,
): CategoryGroup | undefined {
  const groupId = categoryToGroup.get(category);
  if (!groupId) {
    return undefined;
  }
  return getCategoryGroup(groupId);
}

export function expandCategoryGroups(
  groupIds: readonly CategoryGroupId[],
): Category[] {
  const expanded = new Set<Category>();
  for (const groupId of groupIds) {
    for (const category of getCategoryGroup(groupId).categories) {
      expanded.add(category);
    }
  }
  return [...expanded];
}

export function mergeCategoryGroupsWithExisting(
  selectedGroupIds: readonly CategoryGroupId[],
  existingCategories: readonly Category[],
): Category[] {
  const merged = new Set<Category>();

  for (const groupId of selectedGroupIds) {
    const group = getCategoryGroup(groupId);
    const existingInGroup = existingCategories.filter((category) =>
      group.categories.includes(category),
    );

    if (existingInGroup.length > 0) {
      for (const category of existingInGroup) {
        merged.add(category);
      }
      continue;
    }

    const canonical = group.categories[0];
    if (canonical) {
      merged.add(canonical);
    }
  }

  return [...merged];
}

export function collapseCategoriesToGroups(
  categories: readonly Category[],
): CategoryGroupId[] {
  const groupIds = new Set<CategoryGroupId>();
  for (const category of categories) {
    const groupId = categoryToGroup.get(category);
    if (groupId) {
      groupIds.add(groupId);
    }
  }
  return CATEGORY_GROUP_IDS.filter((groupId) => groupIds.has(groupId));
}

export function spaceMatchesCategoryGroups(
  spaceCategories: readonly Category[],
  selectedGroupIds: readonly CategoryGroupId[],
): boolean {
  if (selectedGroupIds.length === 0) {
    return true;
  }

  return selectedGroupIds.some((groupId) =>
    getCategoryGroup(groupId).categories.some((category) =>
      spaceCategories.includes(category),
    ),
  );
}

export function extractUniqueCategoryGroups(
  spaces: readonly { categories?: readonly Category[] | null }[],
): CategoryGroupId[] {
  const groupIds = new Set<CategoryGroupId>();
  for (const space of spaces) {
    for (const groupId of collapseCategoriesToGroups(space.categories ?? [])) {
      groupIds.add(groupId);
    }
  }
  return CATEGORY_GROUP_IDS.filter((groupId) => groupIds.has(groupId));
}

export function parseCategoryGroupFilterParam(
  raw: string | undefined,
): CategoryGroupId[] {
  if (!raw?.trim()) {
    return [];
  }

  const groupIds = new Set<CategoryGroupId>();
  for (const token of raw.split(',')) {
    const value = token.trim();
    if (!value) {
      continue;
    }

    if (isCategoryGroupId(value)) {
      groupIds.add(value);
      continue;
    }

    if ((CATEGORIES as readonly string[]).includes(value)) {
      const group = findCategoryGroupForCategory(value as Category);
      if (group) {
        groupIds.add(group.id);
      }
    }
  }

  return CATEGORY_GROUP_IDS.filter((groupId) => groupIds.has(groupId));
}

export function extractUniqueCategories(
  spaces: readonly { categories?: readonly Category[] | null }[],
): Category[] {
  const categoriesSet = new Set<Category>();
  for (const space of spaces) {
    for (const category of space.categories ?? []) {
      categoriesSet.add(category);
    }
  }
  return [...categoriesSet];
}

export function parseCategoryFilterParam(raw: string | undefined): Category[] {
  if (!raw?.trim()) {
    return [];
  }

  const categories: Category[] = [];
  for (const token of raw.split(',')) {
    const value = token.trim();
    if (!(CATEGORIES as readonly string[]).includes(value)) {
      continue;
    }
    const category = value as Category;
    if (!categories.includes(category)) {
      categories.push(category);
    }
  }
  return categories;
}

export function getCategoryLabel(category: Category): string {
  return (
    categoryOptions.find((option) => option.value === category)?.label ??
    category
  );
}
