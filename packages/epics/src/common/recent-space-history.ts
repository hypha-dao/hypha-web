const RECENT_SPACE_STORAGE_KEY = 'hypha:recent-space-slugs';
const RECENT_SPACE_HISTORY_EVENT = 'hypha:recent-space-slugs:changed';
export const MAX_VISIBLE_RECENT_SPACES = 4;
// Keep extra history so we can still render 4 items after filtering out
// the active slug or stale entries.
export const MAX_RECENT_SPACE_HISTORY = 12;

function normalizeSlug(slug?: string | null): string | null {
  if (typeof slug !== 'string') return null;
  const trimmed = slug.trim();
  return trimmed.length > 0 ? trimmed : null;
}

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
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) return readRecentSpaceSlugs();
  const current = readRecentSpaceSlugs();
  const next = [
    normalizedSlug,
    ...current.filter((s) => s !== normalizedSlug),
  ].slice(0, MAX_RECENT_SPACE_HISTORY);
  writeRecentSpaceSlugs(next);
  return next;
}

/**
 * Persist recents from a route transition: add the exited space at the top and
 * remove the newly active space from history to keep "Recently Visited" stable.
 */
export function recordExitedSpaceSlug(
  exitedSlug?: string | null,
  activeSlug?: string | null,
): string[] {
  const normalizedExitedSlug = normalizeSlug(exitedSlug);
  const normalizedActiveSlug = normalizeSlug(activeSlug);
  const current = readRecentSpaceSlugs();

  let next = current.filter((slug) => slug !== normalizedActiveSlug);
  if (normalizedExitedSlug && normalizedExitedSlug !== normalizedActiveSlug) {
    next = [
      normalizedExitedSlug,
      ...next.filter((slug) => slug !== normalizedExitedSlug),
    ];
  }

  next = next.slice(0, MAX_RECENT_SPACE_HISTORY);
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
