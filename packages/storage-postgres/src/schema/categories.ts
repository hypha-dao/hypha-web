import { pgEnum } from 'drizzle-orm/pg-core';

export const CATEGORIES = [
  'art',
  'biodiversity',
  'education',
  'energy',
  'events',
  'finance',
  'governance',
  'health',
  'housing',
  'mobility',
  'land',
  'sandbox',
  'tech',
  'usecase',
  'ocean',
] as const;

export const categories = pgEnum('categories', CATEGORIES);
