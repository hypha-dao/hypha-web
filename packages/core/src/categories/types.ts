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
  'land',
  'mobility',
  'ocean',
  'sandbox',
  'tech',
  'usecase',
] as const;
export type Category = (typeof CATEGORIES)[number];
