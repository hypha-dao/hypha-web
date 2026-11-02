// SPIKE #2616: one place for the approved list (D1) and the visible sections.
export function getWlAllowedSlugs(): string[] {
  return (
    process.env.WL_ALLOWED_SLUGS ?? 'ponta-do-sol-energy-community'
  ).split(',');
}
export const WL_VISIBLE_SECTIONS = [
  'overview',
  'energy',
  'agreements',
  'members',
  'treasury',
];
