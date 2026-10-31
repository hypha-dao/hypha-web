/**
 * Extracts the DHO space slug from the current pathname.
 *
 * App routes use `/{lang}/dho/{spaceSlug}/...` (e.g. coherence tab is
 * `.../dho/2026-1/coherence`). The AI panel lives in the root layout, where
 * `useParams().id` is not always populated for nested routes — the pathname
 * remains authoritative.
 */
export function getDhoSpaceSlugFromPathname(
  pathname: string | null | undefined,
): string | undefined {
  if (!pathname) return undefined;
  // App routes are `/[lang]/dho/[id]/…`; avoid matching a stray `/…/dho/…` segment.
  const withLocale = pathname.match(/^\/[^/]+\/dho\/([^/]+)/);
  if (withLocale) return withLocale[1];
  const root = pathname.match(/^\/dho\/([^/]+)/);
  return root?.[1];
}

/** True for `/{lang}/dho/...` (and rare `/dho/...`) space routes. */
export function isDhoSpacePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    /^\/[^/]+\/dho(?:\/|$)/.test(pathname) || /^\/dho(?:\/|$)/.test(pathname)
  );
}

/**
 * Space slug for the human chat panel.
 * Pathname wins. `params.id` is only a fallback on a real DHO URL — after
 * navigating to `/network` or Home the root layout can still expose a stale
 * `id`, which must not reopen that space's rooms.
 */
export function routeSpaceSlugFromLocation(input: {
  pathname: string | null | undefined;
  paramId?: string | null;
}): string {
  const fromPath = getDhoSpaceSlugFromPathname(input.pathname)?.trim() || '';
  if (fromPath) return fromPath;
  const param = input.paramId?.trim() || '';
  if (!param || !isDhoSpacePath(input.pathname)) return '';
  return param;
}
