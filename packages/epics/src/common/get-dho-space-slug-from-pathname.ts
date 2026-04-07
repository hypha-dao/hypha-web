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
  const match = pathname.match(/\/dho\/([^/]+)/);
  return match?.[1];
}
