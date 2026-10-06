import { isHyphaPlatformSpace } from './is-hypha-platform-space';

/**
 * Traction (paying-spaces) is the Hypha / Hypha Platform ops dashboard.
 * Temporarily hidden on those orgs; leave the list empty (or set
 * NEXT_PUBLIC_PAYING_SPACES_HIDDEN_SLUGS=) to show it again.
 *
 * Verified slugs: `hypha` (Hypha) and `hypha-platform` (Hypha Platform).
 */
export const DEFAULT_PAYING_SPACES_HIDDEN_SLUGS = [
  'hypha',
  'hypha-platform',
] as const;

const HIDDEN_SLUGS_ENV = 'NEXT_PUBLIC_PAYING_SPACES_HIDDEN_SLUGS';

function parseHiddenSlugs(raw: string | undefined): readonly string[] | null {
  if (raw === undefined) return null;
  return raw
    .split(',')
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);
}

export function getPayingSpacesHiddenSlugs(): ReadonlySet<string> {
  const parsed = parseHiddenSlugs(process.env[HIDDEN_SLUGS_ENV]);
  if (parsed) return new Set(parsed);
  return new Set(DEFAULT_PAYING_SPACES_HIDDEN_SLUGS);
}

export function isPayingSpacesHiddenForSlug(slug: string): boolean {
  return getPayingSpacesHiddenSlugs().has(slug.trim().toLowerCase());
}

/**
 * Traction / paying-spaces UI is only for Hypha platform spaces, and can be
 * temporarily hidden per slug (see {@link isPayingSpacesHiddenForSlug}).
 */
export function isPayingSpacesDashboardEnabled(input: {
  slug: string;
}): boolean {
  return (
    isHyphaPlatformSpace(input) && !isPayingSpacesHiddenForSlug(input.slug)
  );
}
