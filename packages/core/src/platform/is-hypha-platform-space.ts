/** True when the space is the Hypha platform org (platform-wide ops dashboards). */
export function isHyphaPlatformSpace(input: {
  slug: string;
  title?: string | null;
}): boolean {
  const slug = input.slug.trim().toLowerCase();
  const title = (input.title ?? '').trim().toLowerCase();
  return slug === 'hypha' || title === 'hypha';
}
