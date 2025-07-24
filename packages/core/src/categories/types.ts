export const CATEGORIES = [
  'art',
  'biodiversity',
  'education',
  'energy',
  'events',
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
