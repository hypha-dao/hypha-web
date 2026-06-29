import {
  CATEGORY_GROUP_IDS,
  type CategoryGroupId,
  getCategoryGroupLabel,
} from './groups';

const CATEGORY_GROUP_KEYWORDS: Record<CategoryGroupId, readonly string[]> = {
  arts_culture: [
    'art',
    'arts',
    'culture',
    'media',
    'gaming',
    'game',
    'sport',
    'tourism',
    'creative',
    'music',
    'film',
    'museum',
  ],
  environment: [
    'environment',
    'climate',
    'biodiversity',
    'bioregion',
    'land',
    'ocean',
    'water',
    'ecology',
    'nature',
    'sustainability',
    'carbon',
    'planet',
  ],
  energy: ['energy', 'solar', 'renewable', 'power', 'electric', 'grid'],
  places: [
    'housing',
    'city',
    'cities',
    'village',
    'villages',
    'urban',
    'place',
    'neighborhood',
    'neighbourhood',
  ],
  food: ['food', 'agriculture', 'farm', 'farming', 'agri'],
  health: [
    'health',
    'wellbeing',
    'well-being',
    'medical',
    'emergency',
    'wellness',
    'care',
  ],
  education: [
    'education',
    'knowledge',
    'learning',
    'research',
    'university',
    'school',
    'academic',
  ],
  governance: [
    'governance',
    'finance',
    'network',
    'dao',
    'policy',
    'legal',
    'treasury',
    'cooperative',
    'co-op',
  ],
  economy: [
    'economy',
    'trade',
    'commerce',
    'distribution',
    'goods',
    'services',
    'market',
    'business',
  ],
  technology: [
    'innovation',
    'tech',
    'technology',
    'software',
    'digital',
    'ai',
    'startup',
    'ideation',
    'idea',
    'ideas',
    'platform',
    'builder',
  ],
};

function scoreCategoryGroup(text: string, groupId: CategoryGroupId): number {
  let score = 0;
  for (const keyword of CATEGORY_GROUP_KEYWORDS[groupId]) {
    const pattern = new RegExp(
      `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'i',
    );
    if (pattern.test(text)) {
      score += keyword.length >= 6 ? 2 : 1;
    }
  }
  return score;
}

/** Infer 1–2 Hypha network category groups from free-text discovery answers. */
export function inferCategoryGroupsFromText(text: string): CategoryGroupId[] {
  const normalized = text.trim();
  if (!normalized) {
    return ['technology'];
  }

  const scored = CATEGORY_GROUP_IDS.map((groupId) => ({
    groupId,
    score: scoreCategoryGroup(normalized, groupId),
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return ['technology'];
  }

  const primary = scored[0]!.groupId;
  const secondary =
    scored[1] && scored[1].score >= scored[0]!.score * 0.6
      ? scored[1].groupId
      : null;

  return secondary && secondary !== primary ? [primary, secondary] : [primary];
}

export function formatCategoryGroupLabels(groupIds: CategoryGroupId[]): string {
  return groupIds.map((id) => getCategoryGroupLabel(id)).join(', ');
}
