import { getActiveTabFromPath } from '../../common/get-active-tab-from-path';

/**
 * Member mobile menus. One space at a time: the space in the URL, otherwise
 * the most recently opened membership.
 */
export const MEMBER_COMMUNITY_SECTIONS = [
  { key: 'coherence', segment: 'coherence' },
  { key: 'agreements', segment: 'agreements' },
  { key: 'treasury', segment: 'treasury' },
  { key: 'members', segment: 'members' },
] as const;

export type MemberCommunitySectionKey =
  (typeof MEMBER_COMMUNITY_SECTIONS)[number]['key'];

export function isMemberMobilePersona(
  orientation: string | null | undefined,
): boolean {
  return orientation === 'member';
}

export function pickMemberFocusSpaceSlug({
  pathSlug,
  recentSlugs,
  membershipSlugs,
}: {
  pathSlug: string | null | undefined;
  recentSlugs: readonly string[];
  membershipSlugs: readonly string[];
}): string | null {
  if (pathSlug) return pathSlug;
  if (membershipSlugs.length === 0) return recentSlugs[0] ?? null;
  const membership = new Set(membershipSlugs);
  for (const slug of recentSlugs) {
    if (membership.has(slug)) return slug;
  }
  return membershipSlugs[0] ?? null;
}

export function memberSpaceSectionHref(
  lang: string,
  slug: string,
  segment: string,
): string {
  return `/${lang}/dho/${slug}/${segment}`;
}

/** Energy tab. Falls back to home until a space is known. */
export function memberEnergyHref(lang: string, slug: string | null): string {
  return slug ? memberSpaceSectionHref(lang, slug, 'energy') : `/${lang}/home`;
}

/** Community opens the focused space on Signals. */
export function memberCommunityHref(lang: string, slug: string | null): string {
  return slug
    ? memberSpaceSectionHref(lang, slug, 'coherence')
    : `/${lang}/home`;
}

export function isMemberEnergyPath(pathname: string): boolean {
  return /\/dho\/[^/]+\/energy(?:\/|$)/.test(pathname);
}

/** A space screen other than Energy, which has its own bottom tab. */
export function isMemberCommunityPath(pathname: string): boolean {
  return /\/dho\/[^/]+(?:\/|$)/.test(pathname) && !isMemberEnergyPath(pathname);
}

export function memberCommunitySectionKey(
  pathname: string,
): MemberCommunitySectionKey | null {
  const tab = getActiveTabFromPath(pathname);
  if (tab === 'banking') return 'treasury';
  if (
    tab === 'coherence' ||
    tab === 'agreements' ||
    tab === 'treasury' ||
    tab === 'members'
  ) {
    return tab;
  }
  return null;
}
