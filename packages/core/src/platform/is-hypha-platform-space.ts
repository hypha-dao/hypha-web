const PLATFORM_SLUGS = new Set(['hypha', 'hypha-platform']);

/** True when the space is the Hypha platform org (platform-wide ops dashboards). */
export function isHyphaPlatformSpace(input: { slug: string }): boolean {
  return PLATFORM_SLUGS.has(input.slug.trim().toLowerCase());
}
