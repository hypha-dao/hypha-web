const RECENT_SPACE_STORAGE_KEY = 'hypha:recent-space-slugs';
const RECENT_SPACE_HISTORY_EVENT = 'hypha:recent-space-slugs:changed';
export const MAX_VISIBLE_RECENT_SPACES = 4;
/**
 * Keep a wider buffer than the visible count so filtering (active slug, stale/deleted
 * spaces, or temporarily unavailable records) still leaves enough candidates to render
 * 4 "Recently Visited" entries consistently.
 */
export const MAX_RECENT_SPACE_HISTORY = 12;

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
  try {
    window.localStorage.setItem(
      RECENT_SPACE_STORAGE_KEY,
      JSON.stringify(normalized),
    );
    window.dispatchEvent(new Event(RECENT_SPACE_HISTORY_EVENT));
  } catch {
    // Ignore storage failures (private mode / quota issues) to avoid blocking navigation.
  }
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

export function subscribeRecentSpaceSlugs(
  onChange: (slugs: string[]) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const sync = () => onChange(readRecentSpaceSlugs());
  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key !== RECENT_SPACE_STORAGE_KEY) return;
    sync();
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(RECENT_SPACE_HISTORY_EVENT, sync);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(RECENT_SPACE_HISTORY_EVENT, sync);
  };
}
