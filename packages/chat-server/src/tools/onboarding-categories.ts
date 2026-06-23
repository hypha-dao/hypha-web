import { z } from 'zod';
import { CATEGORIES, type Category } from '../../../core/src/categories/types';
import {
  CATEGORY_GROUPS,
  isCategoryGroupId,
  mergeCategoryGroupsWithExisting,
  type CategoryGroupId,
} from '../../../core/src/categories/groups';
import { inferCategoryGroupsFromText } from '../../../core/src/categories/infer-category-groups';

/** Category slugs accepted by create_space_from_onboarding and create_ecosystem_space. */
export const ONBOARDING_CATEGORY_SLUGS = [
  'art',
  'events',
  'arts',
  'biodiversity',
  'bioregions',
  'cities',
  'culture',
  'education',
  'emergency',
  'energy',
  'finance',
  'food',
  'gaming',
  'governance',
  'health',
  'housing',
  'innovation',
  'knowledge',
  'land',
  'media',
  'mobility',
  'networks',
  'ocean',
  'distribution',
  'goods',
  'services',
  'sport',
  'tech',
  'tourism',
  'villages',
  'water',
  'wellbeing',
] as const satisfies readonly Category[];

const VALID_CATEGORY_SLUGS = new Set<string>(ONBOARDING_CATEGORY_SLUGS);

const GROUP_LABEL_TO_ID = new Map<string, CategoryGroupId>(
  CATEGORY_GROUPS.flatMap((group) => [
    [group.label.toLowerCase(), group.id],
    [group.id.replace(/_/g, ' '), group.id],
  ]),
);

function tokenizeCategoryInput(value: string): string[] {
  return value
    .split(/[,;|/]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function collectCategoryTokens(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap((entry) =>
      typeof entry === 'string' ? tokenizeCategoryInput(entry) : [],
    );
  }
  if (typeof input === 'string') {
    return tokenizeCategoryInput(input);
  }
  return [];
}

function resolveGroupId(token: string): CategoryGroupId | null {
  const lower = token.toLowerCase().trim();
  const slug = lower.replace(/\s+&\s+/g, ' ').replace(/\s+/g, '_');

  if (isCategoryGroupId(slug)) return slug;
  if (isCategoryGroupId(lower)) return lower;

  const byLabel = GROUP_LABEL_TO_ID.get(lower);
  if (byLabel) return byLabel;

  const partial = CATEGORY_GROUPS.find(
    (group) =>
      group.label.toLowerCase() === lower ||
      group.label.toLowerCase().includes(lower),
  );
  return partial?.id ?? null;
}

/** Map group ids/labels and invalid tokens to valid Hypha category slugs. */
export function normalizeOnboardingCategories(input: unknown): Category[] {
  const tokens = collectCategoryTokens(input);
  const groupIds = new Set<CategoryGroupId>();
  const directCategories = new Set<Category>();

  for (const token of tokens) {
    const lower = token.toLowerCase().trim();
    const slug = lower.replace(/\s+&\s+/g, ' ').replace(/\s+/g, '_');

    if (VALID_CATEGORY_SLUGS.has(lower)) {
      directCategories.add(lower as Category);
      continue;
    }
    if (VALID_CATEGORY_SLUGS.has(slug)) {
      directCategories.add(slug as Category);
      continue;
    }

    const groupId = resolveGroupId(token);
    if (groupId) {
      groupIds.add(groupId);
    }
  }

  const fromGroups = mergeCategoryGroupsWithExisting(
    [...groupIds],
    [...directCategories],
  );
  return [...new Set<Category>([...directCategories, ...fromGroups])];
}

export function resolveOnboardingCategories(
  input: unknown,
  fallbackText?: string,
): Category[] {
  const normalized = normalizeOnboardingCategories(input);
  if (normalized.length > 0) {
    return normalized;
  }
  if (!fallbackText?.trim()) {
    return [];
  }
  return mergeCategoryGroupsWithExisting(
    inferCategoryGroupsFromText(fallbackText),
    [],
  );
}

export function createOnboardingCategoriesSchema() {
  const slugSchema = z.enum(ONBOARDING_CATEGORY_SLUGS);
  return z.preprocess(
    (value) => normalizeOnboardingCategories(value ?? []),
    z.array(slugSchema).optional().default([]),
  );
}

export const ONBOARDING_CATEGORY_GROUP_LABELS = CATEGORY_GROUPS.map(
  (group) => group.label,
);

export const ONBOARDING_CATEGORY_USAGE_INSTRUCTION =
  'Categories for create_space_from_onboarding and create_ecosystem_space must be category slugs from suggested_categories (for example biodiversity, innovation, education)—never group ids (environment), never group labels (Environment, Innovation & Tech), and never invented tags. If unsure, omit categories and the server will infer from purpose.';
