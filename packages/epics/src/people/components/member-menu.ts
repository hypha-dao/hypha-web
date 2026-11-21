import { getActiveTabFromPath } from '../../common/get-active-tab-from-path';

/**
 * Member chrome. Builders and funders keep the shared top menu.
 * Members see one space: Home, Energy (energy communities only), Wallet,
 * and Messages, plus the community screens.
 */
export type MemberMenuKey =
  | 'home'
  | 'energy'
  | 'wallet'
  | 'messages'
  | 'signals'
  | 'decisions'
  | 'treasury'
  | 'members';

export type MemberMenuGroup = 'you' | 'community';

export type MemberMenuItem = {
  key: MemberMenuKey;
  group: MemberMenuGroup;
  href: string;
  active: boolean;
};

const YOU_KEYS: readonly MemberMenuKey[] = [
  'home',
  'energy',
  'wallet',
  'messages',
];

const COMMUNITY_KEYS: readonly MemberMenuKey[] = [
  'signals',
  'decisions',
  'treasury',
  'members',
];

export function isMemberOrientation(
  orientation: string | null | undefined,
): boolean {
  return orientation === 'member';
}

export function memberMenuHref(
  lang: string,
  spaceSlug: string,
  key: MemberMenuKey,
): string {
  if (key === 'wallet') return `/${lang}/my-wallet`;
  const slug = spaceSlug.trim();
  if (!slug) {
    return key === 'messages' ? `/${lang}/messages` : '';
  }
  const space = `/${lang}/dho/${slug}`;
  switch (key) {
    case 'home':
      return `${space}/overview?board=space`;
    case 'energy':
      return `${space}/energy`;
    case 'messages':
      return `/${lang}/messages?space=${encodeURIComponent(slug)}`;
    case 'signals':
      return `${space}/coherence`;
    case 'decisions':
      return `${space}/agreements`;
    case 'treasury':
      return `${space}/treasury`;
    case 'members':
      return `${space}/members`;
  }
}

export function activeMemberMenuKey(pathname: string): MemberMenuKey | null {
  if (/^\/[^/]+\/my-wallet(?:\/|$)/.test(pathname)) return 'wallet';
  if (/^\/[^/]+\/(?:messages|connections)(?:\/|$)/.test(pathname))
    return 'messages';
  if (!/\/dho\/[^/]+/.test(pathname)) return null;
  switch (getActiveTabFromPath(pathname)) {
    case 'overview':
      return 'home';
    case 'energy':
      return 'energy';
    case 'coherence':
      return 'signals';
    case 'agreements':
      return 'decisions';
    case 'treasury':
    case 'banking':
      return 'treasury';
    case 'members':
      return 'members';
    default:
      return null;
  }
}

export function isCommunityMenuKey(key: MemberMenuKey | null): boolean {
  return key != null && COMMUNITY_KEYS.includes(key);
}

export function buildMemberMenu(input: {
  lang: string;
  spaceSlug: string;
  pathname: string;
  energyEnabled: boolean;
}): MemberMenuItem[] {
  const active = activeMemberMenuKey(input.pathname);
  const keys = [...YOU_KEYS, ...COMMUNITY_KEYS].filter(
    (key) => key !== 'energy' || input.energyEnabled,
  );
  return keys.map((key) => ({
    key,
    group: YOU_KEYS.includes(key) ? 'you' : 'community',
    href: memberMenuHref(input.lang, input.spaceSlug, key),
    active: active === key,
  }));
}

export function memberMenuGroup(
  items: readonly MemberMenuItem[],
  group: MemberMenuGroup,
): MemberMenuItem[] {
  return items.filter((item) => item.group === group);
}

/**
 * The space in the URL wins. Otherwise the most recently opened space the
 * member belongs to, then the first membership.
 */
const QUERY_SPACE_SLUG = /^[a-z0-9_-]{1,80}$/i;

export function resolveMemberSpaceSlug(input: {
  pathSlug: string | null;
  /** `?space=` on Messages. Wins over recent history, loses to a `/dho/` path. */
  querySlug?: string | null;
  memberSlugs: readonly string[];
  recentSlugs: readonly string[];
}): string | null {
  const pathSlug = input.pathSlug?.trim() || null;
  if (pathSlug) return pathSlug;
  const querySlug = input.querySlug?.trim() || null;
  if (querySlug && QUERY_SPACE_SLUG.test(querySlug)) return querySlug;
  const member = new Set(input.memberSlugs);
  for (const slug of input.recentSlugs) {
    if (member.has(slug)) return slug;
  }
  return input.memberSlugs[0] ?? null;
}

/**
 * Personal home, spaces, and network send a member into their space.
 * Messages without a space query open that space's messages.
 * Wallet and space routes stay where they are.
 */
export function memberPersonalRedirect(input: {
  pathname: string;
  search: string;
  lang: string;
  spaceSlug: string;
}): string | null {
  const slug = input.spaceSlug.trim();
  if (!slug) return null;
  if (/^\/[^/]+\/my-wallet(?:\/|$)/.test(input.pathname)) return null;
  if (/\/dho\/[^/]+/.test(input.pathname)) return null;
  if (/^\/[^/]+\/(?:messages|connections)(?:\/|$)/.test(input.pathname)) {
    const params = new URLSearchParams(
      input.search.startsWith('?') ? input.search.slice(1) : input.search,
    );
    if (params.get('space') === slug) return null;
    return memberMenuHref(input.lang, slug, 'messages');
  }
  if (
    /^\/[^/]+\/(?:home|my-dashboard)\/?$/.test(input.pathname) ||
    /^\/[^/]+\/my-spaces(?:\/|$)/.test(input.pathname) ||
    /^\/[^/]+\/network(?:\/|$)/.test(input.pathname)
  ) {
    return memberMenuHref(input.lang, slug, 'home');
  }
  return null;
}
