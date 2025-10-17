import { pgEnum } from 'drizzle-orm/pg-core';

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
export const categories = pgEnum('categories', CATEGORIES);
