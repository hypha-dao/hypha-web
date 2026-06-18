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
    nextSegment && VALID_DHO_TABS.has(nextSegment) ? nextSegment : 'agreements';

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
