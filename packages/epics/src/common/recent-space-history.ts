const RECENT_SPACE_STORAGE_KEY = 'hypha:recent-space-slugs';
export const MAX_VISIBLE_RECENT_SPACES = 4;
export const MAX_RECENT_SPACE_HISTORY = MAX_VISIBLE_RECENT_SPACES + 1;

export function readRecentSpaceSlugs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SPACE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((slug): slug is string => typeof slug === 'string' && !!slug)
      .slice(0, MAX_RECENT_SPACE_HISTORY);
  } catch {
    return [];
  }
}

export function writeRecentSpaceSlugs(slugs: string[]): void {
  if (typeof window === 'undefined') return;
  const normalized = slugs
    .filter((slug): slug is string => typeof slug === 'string' && !!slug)
    .slice(0, MAX_RECENT_SPACE_HISTORY);
  window.localStorage.setItem(
    RECENT_SPACE_STORAGE_KEY,
    JSON.stringify(normalized),
  );
}

export function prependRecentSpaceSlug(slug?: string | null): string[] {
  if (!slug) return readRecentSpaceSlugs();
  const current = readRecentSpaceSlugs();
  const next = [slug, ...current.filter((s) => s !== slug)].slice(
    0,
    MAX_RECENT_SPACE_HISTORY,
  );
  writeRecentSpaceSlugs(next);
  return next;
}
