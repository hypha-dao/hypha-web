import { pgEnum } from 'drizzle-orm/pg-core';

export const CATEGORIES = [
  'housing',
  'energy',
  'mobility',
  'water',
  'air',
  'soil',
  'flora',
  'fauna',
  'fungi',
  'food',
  'education',
  'art',
  'health',
  'tech',
] as const;

export const categories = pgEnum('categories', CATEGORIES);
