'use client';

import {
  clearAuthReturnPath,
  consumeAuthReturnPath,
  peekAuthReturnPath,
} from './auth-return-path';

const VALID_DHO_TABS = new Set([
  'overview',
  'ecosystem-navigation',
  'coherence',
  'agreements',
  'members',
  'treasury',
  'banking',
  'rewards',
  'memory',
]);

const DHO_SPACE_SLUG_FROM_PATH = /^\/[^/]+\/dho\/([^/]+)/;

function getDhoSpaceSlugFromPathname(pathname: string): string | undefined {
  return pathname.match(DHO_SPACE_SLUG_FROM_PATH)?.[1];
}

function getDhoSpaceContextPath({
  pathname,
  lang,
  spaceSlug,
}: {
  pathname: string;
  lang: string;
  spaceSlug: string;
}): string {
  const match = pathname.match(/^\/[^/]+\/dho\/[^/]+(?:\/([^/]+))?/);
  if (!match) {
    return pathname;
  }

  const nextSegment = match[1];
  const activeTab =
    nextSegment && VALID_DHO_TABS.has(nextSegment) ? nextSegment : 'overview';

  return `/${lang}/dho/${spaceSlug}/${activeTab}`;
}

type ResolvePostAuthRedirectPathParams = {
  pathname: string;
  lang?: string;
  baseRedirectPath: string;
  consume?: boolean;
};

export function resolvePostAuthRedirectPath({
  pathname,
  lang,
  baseRedirectPath,
  consume = true,
}: ResolvePostAuthRedirectPathParams): string | null {
  const storedPath = consume ? consumeAuthReturnPath() : peekAuthReturnPath();
  if (!storedPath) {
    return null;
  }

  const spaceSlug = getDhoSpaceSlugFromPathname(storedPath);
  if (spaceSlug && lang) {
    return getDhoSpaceContextPath({
      pathname: storedPath,
      lang,
      spaceSlug,
    });
  }

  if (consume) {
    clearAuthReturnPath();
  }

  return storedPath;
}

export function resolvePostAuthRedirectPathOrDefault(
  params: ResolvePostAuthRedirectPathParams,
): string {
  const resolved = resolvePostAuthRedirectPath(params);
  if (resolved) {
    return resolved;
  }

  if (params.pathname.includes('/dho/')) {
    return params.pathname;
  }

  return params.baseRedirectPath;
}

/**
 * Authenticated entry. A Privy session with no `people` row opens the welcome
 * flow. A session that already has a profile opens My dashboard.
 * Never `/interactive-create` (space AI) and never `/my-spaces`.
 */
export function resolveAccountEntryPath({
  lang,
  hasProfile,
}: {
  lang?: string;
  hasProfile: boolean;
}): string {
  return hasProfile ? accountHomePath(lang) : accountSignupPath(lang);
}

function accountHomePath(lang?: string): string {
  return lang ? `/${lang}/my-dashboard` : '/my-dashboard';
}

function accountSignupPath(lang?: string): string {
  return lang ? `/${lang}/profile/signup` : '/profile/signup';
}
