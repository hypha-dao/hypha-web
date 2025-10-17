/**
 * @todo fix duplication. Origin at `packages/storage-postgres/src/schema/categories.ts`
 */
export const CATEGORIES = [
  // outdated
  'art',
  'events',
  // actual
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
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SPACE_ORDERS = [
  'mostmembers',
  'mostagreements',
  'mostrecent',
] as const;
export type SpaceOrder = (typeof SPACE_ORDERS)[number];

/**
 * @todo fix duplication. Origin at `packages/storage-postgres/src/schema/flags.ts`
 */
export const SPACE_FLAGS = ['sandbox', 'demo'] as const;
export type SpaceFlags = (typeof SPACE_FLAGS)[number];
