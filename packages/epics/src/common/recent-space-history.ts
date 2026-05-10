const RECENT_SPACE_STORAGE_KEY = 'hypha:recent-space-slugs';
const RECENT_SPACE_HISTORY_EVENT = 'hypha:recent-space-slugs:changed';
const LAST_ACTIVE_SPACE_STORAGE_KEY = 'hypha:last-active-space-slug';
export const MAX_VISIBLE_RECENT_SPACES = 4;
// Strict rolling queue of 4 visited (exited) spaces.
export const MAX_RECENT_SPACE_HISTORY = MAX_VISIBLE_RECENT_SPACES;

function normalizeSlug(slug?: string | null): string | null {
  if (typeof slug !== 'string') return null;
  const trimmed = slug.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeQueue(
  slugs: Array<string | null | undefined>,
  options?: { excludeSlug?: string | null },
): string[] {
  const exclude = normalizeSlug(options?.excludeSlug);
  const queue: string[] = [];

  for (const candidate of slugs) {
    const slug = normalizeSlug(candidate);
    if (!slug) continue;
    if (exclude && slug === exclude) continue;
    queue.push(slug);
    if (queue.length >= MAX_RECENT_SPACE_HISTORY) break;
  }

  return queue;
}

export function readRecentSpaceSlugs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SPACE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeQueue(parsed);
  } catch {
    return [];
  }
}

export function writeRecentSpaceSlugs(slugs: string[]): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizeQueue(slugs);
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

export function sanitizeRecentSpaceSlugs(activeSlug?: string | null): string[] {
  const next = normalizeQueue(readRecentSpaceSlugs(), {
    excludeSlug: activeSlug,
  });
  writeRecentSpaceSlugs(next);
  return next;
}

/**
 * Route transition queue update (from -> to):
 * - prepend exited space (`from`) to top
 * - remove active destination (`to`) from queue
 * - keep max 4 unique entries
 */
export function recordRecentSpaceTransition(
  fromSlug?: string | null,
  toSlug?: string | null,
): string[] {
  const from = normalizeSlug(fromSlug);
  const to = normalizeSlug(toSlug);
  const current = readRecentSpaceSlugs();
  const base = normalizeQueue(current, { excludeSlug: to });
  const next =
    from && from !== to
      ? normalizeQueue([from, ...base], { excludeSlug: to })
      : base;
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

function readLastActiveSpaceSlug(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeSlug(
      window.localStorage.getItem(LAST_ACTIVE_SPACE_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

function writeLastActiveSpaceSlug(slug?: string | null): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizeSlug(slug);
  try {
    if (normalized) {
      window.localStorage.setItem(LAST_ACTIVE_SPACE_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(LAST_ACTIVE_SPACE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures so navigation isn't blocked.
  }
}

/**
 * Remount-safe recents updater.
 *
 * Uses a persisted "last active space" to infer transitions even when
 * the sidebar unmounts between route changes.
 */
export function syncRecentSpacesForActiveSlug(
  activeSlug?: string | null,
): string[] {
  const active = normalizeSlug(activeSlug);
  if (!active) return readRecentSpaceSlugs();

  const previousActive = readLastActiveSpaceSlug();
  const next =
    previousActive && previousActive !== active
      ? recordRecentSpaceTransition(previousActive, active)
      : sanitizeRecentSpaceSlugs(active);

  writeLastActiveSpaceSlug(active);
  return next;
}
