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

export const SPACE_ORDERS = [
  'mostmembers',
  'mostactive',
  'mostrecent',
] as const;
export type SpaceOrder = (typeof SPACE_ORDERS)[number];
