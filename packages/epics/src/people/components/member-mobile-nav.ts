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
  membershipsLoaded = false,
}: {
  pathSlug: string | null | undefined;
  recentSlugs: readonly string[];
  membershipSlugs: readonly string[];
  /** False while the membership query is still loading. An empty loaded list is not a membership. */
  membershipsLoaded?: boolean;
}): string | null {
  if (pathSlug) return pathSlug;
  if (!membershipsLoaded) return recentSlugs[0] ?? null;
  if (membershipSlugs.length === 0) return null;
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

/** Home for a member is the focused space, not the network home. */
export function memberSpaceHomeHref(lang: string, slug: string | null): string {
  return slug ? `/${lang}/dho/${slug}/overview` : `/${lang}/home`;
}

export function isMemberSpaceHomePath(
  pathname: string,
  slug: string | null,
): boolean {
  if (!slug) return false;
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^/[^/]+/dho/${escaped}(?:/overview)?/?$`).test(pathname);
}

export function isMemberEnergyPath(pathname: string): boolean {
  return /\/dho\/[^/]+\/energy(?:\/|$)/.test(pathname);
}

/** Signals, Decisions, Treasury, and Members. The space overview is Home. */
export function isMemberCommunityPath(pathname: string): boolean {
  return memberCommunitySectionKey(pathname) != null;
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
