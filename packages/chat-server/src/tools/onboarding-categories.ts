import { z } from 'zod';
import { CATEGORIES, type Category } from '../../../core/src/categories/types';
import {
  CATEGORY_GROUPS,
  isCategoryGroupId,
  mergeCategoryGroupsWithExisting,
  type CategoryGroupId,
} from '../../../core/src/categories/groups';
import {
  formatCategoryGroupLabels,
  inferCategoryGroupsFromText,
} from '../../../core/src/categories/infer-category-groups';

/** Same ten tags as the network map filters and create space form (categoryGroupOptions). */
export const SPACE_CATEGORY_GROUP_CATALOG = CATEGORY_GROUPS.map((group) => ({
  id: group.id,
  label: group.label,
}));

export const SPACE_CATEGORY_GROUP_LABELS = SPACE_CATEGORY_GROUP_CATALOG.map(
  (group) => group.label,
);

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

/** Common user/AI wording mapped to canonical category groups — never invent new tags. */
const GROUP_TOKEN_ALIASES: Record<string, CategoryGroupId> = {
  climate: 'environment',
  sustainability: 'environment',
  ecology: 'environment',
  tech: 'technology',
  technology: 'technology',
  ideation: 'technology',
  ideas: 'technology',
  idea: 'technology',
  agriculture: 'food',
  finance: 'governance',
  learning: 'education',
};

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

  const alias = GROUP_TOKEN_ALIASES[lower] ?? GROUP_TOKEN_ALIASES[slug];
  if (alias) return alias;

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

    const aliasGroup = GROUP_TOKEN_ALIASES[lower] ?? GROUP_TOKEN_ALIASES[slug];
    if (aliasGroup) {
      groupIds.add(aliasGroup);
      continue;
    }

    if (VALID_CATEGORY_SLUGS.has(lower)) {
      directCategories.add(lower as Category);
      const groupFromSlug = resolveGroupId(lower);
      if (groupFromSlug) groupIds.add(groupFromSlug);
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

export const ONBOARDING_CATEGORY_GROUP_LABELS = SPACE_CATEGORY_GROUP_LABELS;

export const ONBOARDING_CATEGORY_USER_FACING_INSTRUCTION = `Space category tags for users are ONLY the ten labels in space_category_groups from onboarding_guidance—the same list as the Hypha network map and create space form: ${SPACE_CATEGORY_GROUP_LABELS.join(
  ', ',
)}. When mentioning categories in chat, use those exact group labels only. Never slug names (biodiversity, innovation), never invented tags (Climate, Creativity, Ideation), and never ask users to pick tags.`;

export const ONBOARDING_CATEGORY_TOOL_INSTRUCTION =
  'For create_space_from_onboarding and create_ecosystem_space, pass suggested_categories from onboarding_guidance exactly (internal slugs). Do not pass group labels or invented tokens—the server normalizes silently.';

export const ONBOARDING_CATEGORY_USAGE_INSTRUCTION = `${ONBOARDING_CATEGORY_USER_FACING_INSTRUCTION} ${ONBOARDING_CATEGORY_TOOL_INSTRUCTION}`;

export function formatAssignedCategoryGroupLabels(
  groupIds: CategoryGroupId[],
): string {
  return formatCategoryGroupLabels(groupIds);
}
