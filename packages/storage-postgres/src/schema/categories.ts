import { pgEnum } from 'drizzle-orm/pg-core';

export const CATEGORIES = [
  'air',
  'art',
  'education',
  'energy',
  'fauna',
  'flora',
  'food',
  'fungi',
  'health',
  'housing',
  'mobility',
  'sandbox',
  'soil',
  'tech',
  'usecase',
  'water',
] as const;

export const categories = pgEnum('categories', CATEGORIES);
